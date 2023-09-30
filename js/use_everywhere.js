import { app } from "../../../scripts/app.js";

function add_ue(ue, type, title, input, output) {
    ue.splice(0,0,{type:type, title:title, input:input, output:output})
}

app.registerExtension({
	name: "cg.customnodes.use_everywhere",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeType.title.startsWith("Anything Everywhere")) {
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (side,slot,connect,link_info,output) {
				onConnectionsChange?.apply(side,slot,connect,link_info,output);
                if (connect && link_info) {
                    const origin_id = link_info.origin_id;
                    const origin_slot = link_info.origin_slot;
                    const input = this.graph._nodes_by_id[origin_id].outputs[origin_slot];
                    this.input_type = input.type;
                    this.inputs[0].name = this.input_type;
                } else {
                    this.input_type = undefined;
                    this.inputs[0].name = "anything";
                }
                
            }
        }
    },
	async setup() {
		const graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            const p = structuredClone(await graphToPrompt.apply(app));
            const nodes = p.workflow.nodes;
            const always = new RegExp(".*");
            var use_everywheres = [];
            nodes.forEach(node => {
                if (node.type.startsWith('UE ')) {
                    if (node.inputs) {
                        for (var i=0; i<node.inputs.length; i++) {
                            if (node.inputs[i].link != null) {
                                add_ue(use_everywheres, node.inputs[i].type, always, always,[node.id.toString(),i])
                            }
                        }
                    } else {
                        add_ue(use_everywheres, node.type.substring(3), always, always, [node.id.toString(),0])
                    }
                }
                if (node.type.startsWith('UE? ')) {
                    if (node.inputs) {
                        for (var i=0; i<node.inputs.length; i++) {
                            if (node.inputs[i].link != null) {
                                add_ue(use_everywheres,node.inputs[i].type,new RegExp(node.widgets_values[0]),new RegExp(node.widgets_values[1]),[node.id.toString(),i])
                            }
                        }
                    } else {
                        add_ue(use_everywheres, node.type.substring(4), new RegExp(node.widgets_values[1]), new RegExp(node.widgets_values[2]), [node.id.toString(),0])
                    }
                }
                if (node.type === "Seed Everywhere") {
                    add_ue(use_everywheres, "INT", always, new RegExp("seed"),[node.id.toString(),0])
                }
                if (node.type === "Anything Everywhere?") {
                    const in_link = node?.inputs[0].link;
                    if (in_link) {
                        const link = app.graph.links[in_link];
                        const type = app.graph._nodes_by_id[node.id.toString()].input_type;
                        if (type) {
                            add_ue(use_everywheres, type, new RegExp(node.widgets_values[0]), new RegExp(node.widgets_values[1]), 
                                            [link.origin_id.toString(), link.origin_slot])
                        }
                    }
                }
                if (node.type === "Anything Everywhere") {
                    const in_link = node?.inputs[0].link;
                    if (in_link) {
                        const link = app.graph.links[in_link];
                        const type = app.graph._nodes_by_id[node.id.toString()].input_type;
                        if (type) {
                            add_ue(use_everywheres, type, always, always, [link.origin_id.toString(), link.origin_slot])
                        }
                    }
                }
            })
            nodes.forEach(node => {
                node.inputs?.forEach(input => {
                    if (input.link === null) {
                        var ue = use_everywheres.find((ue) => (  ue.type===input.type && 
                                                                (ue.title.test(node.properties['Node name for S&R']) || ue.title.test(node?.title)) && 
                                                                 ue.input.test(input.name)
                                                              ));
                        if (ue) {
                            p.output[node.id].inputs[input.name] = ue.output;
                        }
                    }
                });
            });
            return p;
        }
	},

});
