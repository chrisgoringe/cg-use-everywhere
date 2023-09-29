import { app } from "../../../scripts/app.js";

app.registerExtension({
	name: "cg.customnodes.use_everywhere",
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
                                use_everywheres.splice(0,0,{
                                    type : node.inputs[i].type,
                                    title : always,
                                    input : always,
                                    output : [node.id.toString(),i],
                                })
                            }
                        }
                    } else {
                        use_everywheres.splice(0,0,{
                            type : node.type.substring(3),
                            title : always,
                            input : always,
                            output : [node.id.toString(),0],
                        })
                    }
                }
                if (node.type.startsWith('UE? ')) {
                    if (node.inputs) {
                        for (var i=0; i<node.inputs.length; i++) {
                            if (node.inputs[i].link != null) {
                                use_everywheres.splice(0,0,{
                                    type : node.inputs[i].type,
                                    title : new RegExp(node.widgets_values[0]),
                                    input : new RegExp(node.widgets_values[1]),
                                    output : [node.id.toString(),i],
                                })
                            }
                        }
                    } else {
                        use_everywheres.splice(0,0,{
                            type : node.type.substring(4),
                            title : new RegExp(node.widgets_values[1]),
                            input : new RegExp(node.widgets_values[2]),
                            output : [node.id.toString(),0],
                        })
                    }
                }
                if (node.type === "Seed Everywhere") {
                    use_everywheres.splice(0,0,{
                        type : "INT",
                        title : always,
                        input : new RegExp("seed"),
                        output : [node.id.toString(),0],
                    })
                }
                if (node.type === "Anything Everywhere?") {
                    const in_link = node?.inputs[0].link;
                    if (in_link) {
                        const link = app.graph.links[in_link];
                        const origin_node = app.graph._nodes_by_id[link.origin_id.toString()];
                        const output = origin_node.outputs[link.origin_slot];
                        use_everywheres.splice(0,0,{
                            type : output.type,
                            title : new RegExp(node.widgets_values[0]),
                            input : new RegExp(node.widgets_values[1]),
                            output : [link.origin_id.toString(), link.origin_slot],
                        })
                        const detected = app.graph._nodes_by_id[node.id.toString()]?.widgets?.find((w)=>w.name==='detected_type');
                        if(detected) detected.value = output.type;
                    }
                }
                if (node.type === "Anything Everywhere") {
                    const in_link = node?.inputs[0].link;
                    if (in_link) {
                        const link = app.graph.links[in_link];
                        const origin_node = app.graph._nodes_by_id[link.origin_id.toString()];
                        const output = origin_node.outputs[link.origin_slot];
                        use_everywheres.splice(0,0,{
                            type : output.type,
                            title : always,
                            input : always,
                            output : [link.origin_id.toString(), link.origin_slot],
                        })
                        const detected = app.graph._nodes_by_id[node.id.toString()]?.widgets?.find((w)=>w.name==='detected_type');
                        if(detected) detected.value = output.type;
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
