import { app } from "../../../scripts/app.js";
import { UseEverywhereList } from "./use_everywhere_classes.js";
import { add_ue_from_node } from "./use_everywhere_nodes.js";
import { mode_is_live, is_connected } from "./use_everywhere_utilities.js";
import { maybe_remove_text_display, toggle_ue_node_highlights } from "./use_everywhere_ui.js";

function is_UEnode(node_or_nodeType) {
    const title = node_or_nodeType?.title ? node_or_nodeType.title : node_or_nodeType.comfyClass;
    return (title.startsWith("Anything Everywhere") || title==="Seed Everywhere")
}

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

app.registerExtension({
	name: "cg.customnodes.use_everywhere",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (is_UEnode(nodeType)) {
            /*
            When an AE node is connected or disconnected, update its inputs
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
            };
        }
    },

    /*
    Remove the display_text_widget if the option is set to false.
    Use nodeCreated to insert this so that this code will be run after the code to add the text widget
    (inserted by cg_custom_core/ui_output.js in beforeRegisterNodeDef)
    */
    async nodeCreated(node) {
        if (is_UEnode(node)) {
            const onExecuted = node.onExecuted;
            node.onExecuted = function() {
                onExecuted?.apply(this, arguments);
                maybe_remove_text_display(node);
            }
        }
    },

    /*
    The graphToPrompt method is called when the app is going to send a prompt to the server.
    We hijack it, call the original, and return a modified copy.
    */
	async setup() {
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
        Hijack the graphToPrompt function
        */
		_original_graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            return analyse_graph(true);
        }

        /*
        Add to the canvas menu
        */
        const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function () {
            const options = original_getCanvasMenuOptions.apply(this, arguments);
            options.push(null); // divider
            options.push({
                content: `Toggle UE Node highlights`,
                callback: () => {
                    toggle_ue_node_highlights(app, analyse_graph);
                }
            });
            return options;
        }
	},

});
