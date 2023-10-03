import { app } from "../../../scripts/app.js";
import { UseEverywhereList } from "./use_everywhere_classes.js";
import { add_ue_from_node } from "./use_everywhere_nodes.js";
import { node_is_live, is_connected, is_UEnode, Logger } from "./use_everywhere_utilities.js";
import { maybe_remove_text_display, update_input_label } from "./use_everywhere_ui.js";
import { LinkRenderController } from "./use_everywhere_ui.js";

var _original_graphToPrompt;

/*
Get the graph and analyse it.
If modify_and_return_prompt is true, apply UE modifications and return the prompt (for hijack)
If modify_and_return_prompt is false, jsut return the UseEverywhereList (for UI highlights etc) 
*/
async function analyse_graph(modify_and_return_prompt=false) {
    var p = await _original_graphToPrompt.apply(app);
    if (modify_and_return_prompt) {
        p = structuredClone(p);
    } 
            
    // Create a UseEverywhereList and populate it from all live (not bypassed) nodes
    const ues = new UseEverywhereList();
    const live_nodes = p.workflow.nodes.filter((node) => node_is_live(node))
    live_nodes.filter((node) => is_UEnode(node)).forEach(node => { add_ue_from_node(ues, node); })

    // Look for unconnected inputs and see if we can connect them
    live_nodes.filter((node) => !is_UEnode(node)).forEach(node => {
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

function inject_outdating(method) {
    const callback = o.callback;
    o.callback = function() {
        Logger.trace("Node right-click action called", arguments, this)
        callback?.apply(this, arguments);
        _lrc.mark_link_list_outdated();
    }
}

const _lrc = new LinkRenderController(analyse_graph);

app.registerExtension({
	name: "cg.customnodes.use_everywhere",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        /*
        When a node is connected or unconnected, the link list is dirty.
        If it is a UE node, we need to update it as well
        */
        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (side,slot,connect,link_info,output) {        
            Logger.trace("onConnectionsChange", arguments, this);
            if (node.IS_UE) {
                this.input_type[slot] = (connect && link_info) ? this.graph?._nodes_by_id[link_info?.origin_id]?.outputs[link_info?.origin_slot]?.type 
                                                               : undefined;
                update_input_label(this, slot, app);
            }
            _lrc.mark_link_list_outdated();
            onConnectionsChange?.apply(side,slot,connect,link_info,output);
        };

        /*
        Any right click action on a node might make the link list dirty.
        */
        const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function(_, options) {
            Logger.trace("getExtraMenuOptions", arguments, this);
            getExtraMenuOptions?.apply(this, arguments);
            options.forEach((o) => {
                const callback = o.callback;
                o.callback = function() {
                    Logger.trace("Node right-click action called", arguments, this)
                    callback?.apply(this, arguments);
                    _lrc.mark_link_list_outdated();
                }
            })
        }
    },

    async nodeCreated(node) {
        node.IS_UE = is_UEnode(node);
        if (node.IS_UE) {
            node.input_type = [undefined, undefined, undefined]; // for dynamic input types
            /*
            cg_custom_core/ui_output.js inserts code to add a text display widget
            remove that widget if the option isn't checked
            */
            const onExecuted = node.onExecuted;
            node.onExecuted = function() {
                Logger.trace("onExecuted", arguments, this);
                onExecuted?.apply(this, arguments);
                maybe_remove_text_display(node);
            }

            // If a widget on a UE node is edited, link list is dirty
            node.widgets?.forEach((w)=>{
                const callback = w.callback;
                w.callback = function () {
                    Logger.trace("widget callback", arguments, node);
                    callback?.apply(this, arguments);
                    _lrc.mark_link_list_outdated();
                }
            });
        }
        // Any new node makes the link list dirty 
        _lrc.mark_link_list_outdated();
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
        Hijack drawNode to render the virtual links if requested
        */
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            // don't trace - this is called way too often!
            original_drawNode.apply(this, arguments);
            _lrc.render_ue_links(node, ctx);
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

        /* 
        Canvas menu is the right click on backdrop.
        We need to add our option, and hijack the others.
        */
        const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function () {
            // Add our items to the canvas menu 
            const options = original_getCanvasMenuOptions.apply(this, arguments);
            options.push(null); // divider
            options.push({
                content: `Toggle UE link visibility`,
                callback: () => {
                    Logger.trace("Toggle visibility called", arguments);
                    _lrc.toggle_ue_links_visible();
                }
            });
            //  Play it safe - any menu option might make our list dirty
            options.forEach((o)=> {
                const callback = o.callback;
                o.callback = function() {
                    Logger.trace("Canvas right-click option called", arguments);
                    callback?.apply(this, arguments);
                    _lrc.mark_link_list_outdated();
                }
            })
            return options;
        }
	},

});
