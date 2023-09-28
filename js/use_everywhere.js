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
                }
                if (node.type.startsWith('UE? ')) {
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
                }
                if (node.type === "Seed Everywhere") {
                    use_everywheres.splice(0,0,{
                        type : "INT",
                        title : always,
                        input : new RegExp("seed"),
                        output : [node.id.toString(),0],
                    })
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
