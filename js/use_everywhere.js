import { app } from "../../../scripts/app.js";
import { UseEverywhereList } from "./use_everywhere_classes.js";
import { add_ue_from_node } from "./use_everywhere_nodes.js";
import { mode_is_live, is_connected, is_UEnode } from "./use_everywhere_utilities.js";
import { maybe_remove_text_display, LinkRenderController } from "./use_everywhere_ui.js";

var _original_graphToPrompt;

/*
Get the graph and analyse it.
If modify_and_return_prompt is true, apply UE modifications and return the prompt (for hijack)
If modify_and_return_prompt is false, jsut return the UseEverywhereList (for UI highlights etc) 
*/
async function analyse_graph(modify_and_return_prompt=false) {
    const p = structuredClone(await _original_graphToPrompt.apply(app));
            
    // Create a UseEverywhereList and populate it from all live (not bypassed) nodes
    const ues = new UseEverywhereList();
    const live_nodes = p.workflow.nodes.filter((node) => mode_is_live(node.mode));
    live_nodes.forEach(node => { add_ue_from_node(ues, node); })

    // Look for unconnected inputs and see if we can connect them
    live_nodes.forEach(node => {
        node.inputs?.forEach(input => {
            if (!is_connected(input,p.workflow)) {
                var ue = ues.find_best_match(node, input);
                if (ue && modify_and_return_prompt) p.output[node.id].inputs[input.name] = ue.output;
            }
        });
    });
    if (modify_and_return_prompt) return p;
    else return ues;
}

const _lrc = new LinkRenderController(analyse_graph);

app.registerExtension({
	name: "cg.customnodes.use_everywhere",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (is_UEnode(nodeType)) {
            /*
            When an AE node is connected or disconnected, update its input type, name, and colour.
            */
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (side,slot,connect,link_info,output) {                
                // if connecting, find what type of connection; if not, set to undefined
                if (connect && link_info) {
                    const origin_id = link_info.origin_id;
                    const origin_slot = link_info.origin_slot;
                    this.input_type = this.graph._nodes_by_id[origin_id].outputs[origin_slot].type;
                } else {
                    this.input_type = undefined; // it's connected to a Custom Node that isn't installed, so treat as unconnected
                }

                // set the name and colour of the input
                if (this.input_type) {
                    this.inputs[0].name = this.input_type;
                    this.inputs[0].color_on = app.canvas.default_connection_color_byType[this.input_type];
                } else {
                    this.inputs[0].name = "anything";
                    this.inputs[0].color_on = undefined;
                }

                // call the underlying change handler (which will do the redraw etc)
                onConnectionsChange?.apply(side,slot,connect,link_info,output);

                // require a recalculation of the virtual links
                _lrc.mark_link_list_outdated();
            };

            /*
            The bypass menu option has an inline anonymous callback. 
            Find it, hijack it, recalculate links
            */
            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(_, options) {
                getExtraMenuOptions?.apply(this, arguments);
                const bypass = options.find((o)=> o?.content==="Bypass");
                if (bypass) {
                    const callback = bypass.callback;
                    bypass.callback = function() {
                        callback?.apply(this, arguments);
                        _lrc.mark_link_list_outdated();
                    }
                }
            }
        } else {
            var a = 0;
        }
    },

    async nodeCreated(node) {
        if (is_UEnode(node)) {
            // our link list will no longer be valid if there is a new UE node
            _lrc.mark_link_list_outdated();

            /*
            Remove the display_text_widget if the option is set to false.
            Use nodeCreated to insert this so that this code will be run after the code to add the text widget
            (inserted by cg_custom_core/ui_output.js in beforeRegisterNodeDef)
            */
            const onExecuted = node.onExecuted;
            node.onExecuted = function() {
                onExecuted?.apply(this, arguments);
                maybe_remove_text_display(node);
            }

            /*
            If a widget on a UE node is edited, the link list might change.
            So hijack the callback, and mark the list outdated.
            */
            node.widgets?.forEach((w)=>{
                const callback = w.callback;
                w.callback = function () {
                    callback?.apply(this, arguments);
                    _lrc.mark_link_list_outdated();
                }
            });

            /*
            Similarly if a node has its mode changed
            */
            const changeMode = node.changeMode;
            node.changeMode = function() {
                changeMode?.apply(this, arguments);
                _lrc.mark_link_list_outdated();
            }
        }
    },

	async setup() {
        /*
        The graphToPrompt method is called when the app is going to send a prompt to the server.
        We hijack it, call the original, and return a modified copy.
        */
        _original_graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            return analyse_graph(true);
        }
        
        /*
        Add to the settings menu
        */
        app.ui.settings.addSetting({
            id: "AE.details",
            name: "Anything Everywhere node details",
            type: "boolean",
            defaultValue: false,
        });

        const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function () {
            /*
            Add our items to the canvas menu
            */
            const options = original_getCanvasMenuOptions.apply(this, arguments);
            options.push(null); // divider
            options.push({
                content: `Toggle UE link visibility`,
                callback: () => {
                    _lrc.toggle_ue_links_visible();
                }
            });
            /*
            And look for any that relate to Group Node (bypass etc) to hijack them
            */
            options.forEach((o)=> {
                if(o?.content?.includes("Group Nodes")) {
                    const callback = o.callback;
                    o.callback = function() {
                        callback?.apply(this, arguments);
                        _lrc.mark_link_list_outdated();
                    }
                }
            })
            return options;
        }

        /*
        Hijack drawNode to render the virtual links (based on the toggle)
        */
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            original_drawNode.apply(this, arguments);
            _lrc.render_ue_links(node, ctx);
        }
	},

});
