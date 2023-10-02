import { app } from "../../../scripts/app.js";

class UseEverywhereList {
    #ues;
    constructor() { this.#ues = [] }
    static always = new RegExp(".*");
    add_ue(type, output, title=UseEverywhereList.always, input=UseEverywhereList.always, priority = 0) {
        this.#ues.splice(0,0,{type:type, title:title, input:input, output:output, priority:priority});
    }
    find_best_match(input, node) {
        var matches = this.#ues.filter((candidate) => (  
            candidate.type===input.type && 
            (candidate.title.test(node.properties['Node name for S&R']) || candidate.title.test(node?.title)) && 
            candidate.input.test(input.name)
        ));
        if (matches.length==0) { return undefined; }
        if (matches.length>1) {
            matches.sort((a,b) => b.priority-a.priority);
            if(matches[0].priority == matches[1].priority) {
                console.log(`Everywhere nodes found ambiguous matches for '${display_name(node)}' input '${input.name}'`);
                return undefined;
            }
        }
        return matches[0];        
    }
}

function display_name(node) {
    return (node?.title) ? node.title : node.properties['Node name for S&R'];
}

function remove_text_display(node) {
    const w = node.widgets?.findIndex((w) => w.name === "display_text_widget"); // created by cg_custom_nodes
    if (w>=0) {
        const wid = node.widgets[w];
        node.widgets.splice(w,1);   // remove it
        wid?.onRemove();            // cleanly
    }
    node.size = node.computeSize(); // shrink the node
    node.setDirtyCanvas(true, true);// mark for redrawing
}

function mode_is_live(mode){
    if (mode===0) return true;
    if (mode===2 || mode===4) return false;
    console.log("Found node with mode which isn't 0, 2 or 4... confused by treating it as active");
    return true;
}

/*
Does this input (an integer index) connect upstream to a live node?
input.link is the link_id; the form of workflow.links is [id, upnode_id, upnode_output, downnode_id, downnode_output, type]
*/
function is_connected(input, workflow) {
    const link_id = input.link;
    if (link_id === null) return false;                                    // no connection
    const the_link = workflow.links.find((link) => link[0] === link_id);   // link[0] is the link_id
    if (!the_link) return false;                                           // shouldn't happen: link with that id doesn't exist.
    const source_node_id = the_link[1];                                    // link[1] is upstream node_id 
    const source_node = workflow.nodes.find((n) => n.id === source_node_id);
    if (!source_node) return false;                                        // shouldn't happen: node with that id doesn't exist
    return mode_is_live(source_node.mode);                                 // is the upstream node alive?
}


app.registerExtension({
	name: "cg.customnodes.use_everywhere",

    /* 
    Detect when a connection is made or unmade.
    Code added to the prototype for Anything Everywhere and Anything Everywhere?
    */

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeType.title.startsWith("Anything Everywhere")) {
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (side,slot,connect,link_info,output) {
                var input;
                if (connect && link_info) {
                    const origin_id = link_info.origin_id;
                    const origin_slot = link_info.origin_slot;
                    input = this.graph._nodes_by_id[origin_id].outputs[origin_slot];
                } else {
                    input = undefined; // it's connected to a Custom Node that isn't installed!
                }
                if (input) {
                    this.input_type = input.type;
                    this.inputs[0].name = this.input_type;
                    this.inputs[0].color_on = app.canvas.default_connection_color_byType[input.type];
                } else {
                    this.input_type = undefined;
                    this.inputs[0].name = "anything";
                    this.inputs[0].color_on = undefined;
                }
                onConnectionsChange?.apply(side,slot,connect,link_info,output);
            };
        }
    },

    /*
    Remove the display_text_widget if the option is set to false.
    Do this in nodeCreated because the widget gets added in beforeRegisterNodeDef
    and we can't be sure this will run after that.
    */

    async nodeCreated(node) {
        if (node.comfyClass.startsWith("Anything Everywhere") || node.comfyClass.startsWith("Seed Everywhere")) {
            const onExecuted = node.onExecuted;
            node.onExecuted = function() {
                onExecuted?.apply(this, arguments);
                if (!app.ui.settings.getSettingValue('AE.details', false)) {
                    remove_text_display(node);
                }
            }
        }
    },

    /*
    The graphToPrompt method is called when the app is going to send a prompt to the server.
    We hijack it, call the original, and return a modified copy.
    */
	async setup() {
        // Add the setting
        app.ui.settings.addSetting({
            id: "AE.details",
            name: "Anything Everywhere node details",
            type: "boolean",
            defaultValue: false,
        });

		const graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            const p = structuredClone(await graphToPrompt.apply(app));  // don't want to change any underlying objects, just what we send
            
             // Add all of the available sources to the UseEverywhereList
            const ues = new UseEverywhereList();

            /* only want to consider live nodes (not bypassed) */
            const live_nodes = p.workflow.nodes.filter((node) => mode_is_live(node.mode));
            live_nodes.forEach(node => {
                if (node.type.startsWith('UE ')) {
                    if (node.inputs) {
                        for (var i=0; i<node.inputs.length; i++) {
                            if (node.inputs[i].link != null) ues.add_ue(node.inputs[i].type, [node.id.toString(),i]);
                        }
                    } else ues.add_ue(node.type.substring(3), [node.id.toString(),0]);
                }

                if (node.type.startsWith('UE? ')) {
                    if (node.inputs) {
                        for (var i=0; i<node.inputs.length; i++) {
                            if (node.inputs[i].link != null) {
                                ues.add_ue(node.inputs[i].type, [node.id.toString(),i], 
                                            new RegExp(node.widgets_values[0]), new RegExp(node.widgets_values[1]), 10);
                            }
                        }
                    } else {
                        ues.add_ue(node.type.substring(4), [node.id.toString(),0], 
                                    new RegExp(node.widgets_values[1]), new RegExp(node.widgets_values[2]), 10);
                    }
                }

                if (node.type === "Seed Everywhere") ues.add_ue("INT", [node.id.toString(),0], undefined, new RegExp("seed"), 5);

                if (node.type === "Anything Everywhere?") {
                    const in_link = node?.inputs[0].link;
                    if (in_link) {
                        const link = app.graph.links[in_link];
                        const type = app.graph._nodes_by_id[node.id.toString()].input_type;
                        if (type) {
                            ues.add_ue(type, [link.origin_id.toString(), link.origin_slot],
                                                new RegExp(node.widgets_values[0]), new RegExp(node.widgets_values[1]), 10);
                        }
                    }
                }
                if (node.type === "Anything Everywhere") {
                    const in_link = node?.inputs[0].link;
                    if (in_link) {
                        const link = app.graph.links[in_link];
                        const type = app.graph._nodes_by_id[node.id.toString()].input_type;
                        if (type) ues.add_ue(type, [link.origin_id.toString(), link.origin_slot]);
                    }
                }
            })

            // Look for unconnected inputs and see if we can connect them
            live_nodes.forEach(node => {
                node.inputs?.forEach(input => {
                    if (!is_connected(input,p.workflow)) {
                        var ue = ues.find_best_match(input, node);
                        if (ue) p.output[node.id].inputs[input.name] = ue.output;
                        else console.log(`Everywhere nodes did not connect '${display_name(node)}' input '${input.name}'`);
                    }
                });
            });
            return p;
        }
	},

});
