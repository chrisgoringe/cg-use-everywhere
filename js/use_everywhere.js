import { app } from "../../../scripts/app.js";

app.registerExtension({
	name: "cg.customnodes.use_everywhere",
	async setup() {
		const graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            const p = structuredClone(await graphToPrompt.apply(app));
            const nodes = p.workflow.nodes;
            var use_everywheres = {};
            nodes.forEach(node => {
                if (node?.type.startsWith('UE ')) {
                    use_everywheres[node.type.substring(3)] = node;
                }
            })
            nodes.forEach(node => {
                if (node.inputs) {
                    for (var i=0; i<node.inputs.length; i++) {
                        var input = node.inputs[i];
                        if (input.link === null) {
                            var ue = use_everywheres[input.type];
                            var ue_id = ue.id.toString();
                            // create a new link
                            //p.workflow.last_link_id += 1; 
                            //const new_link = [p.workflow.last_link_id, ue_id, 0, node.id, i, input.type];
                            //p.workflow.links.splice(p.workflow.links.length,0,new_link);

                            // set it in the workflow
                            //input.link = p.workflow.last_link_id;
                            // in the output
                            p.output[node.id].inputs[input.name] = [ue_id,0];
                            // and on the output node in the workflow
                            //if (ue.outputs[0].links) { ue.outputs[0].links.splice(0,0,p.workflow.last_link_id)}
                            //else { ue.outputs[0].links = [p.workflow.last_link_id] }
                        }
                    };
                }
            });
            return p;
        }
	},
});
