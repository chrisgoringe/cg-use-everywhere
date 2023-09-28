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
                if (node.type.startsWith('UE ')) {
                    for (var i=0; i<node.inputs.length; i++) {
                        if (node.inputs[i].link != null) {
                            use_everywheres[node.inputs[i].type] = [node.id.toString(),i];
                        }
                    }
                }
            })
            nodes.forEach(node => {
                node.inputs?.forEach(input => {
                    if (input.link === null && use_everywheres[input.type]) {
                        p.output[node.id].inputs[input.name] = use_everywheres[input.type];
                    }
                });
            });
            return p;
        }
	},
});
