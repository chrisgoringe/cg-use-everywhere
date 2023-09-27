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
                    use_everywheres[node.type.substring(3)] = node.id.toString();
                }
            })
            nodes.forEach(node => {
                node.inputs?.forEach(input => {
                    if (input.link === null && use_everywheres[input.type]) {
                        p.output[node.id].inputs[input.name] = [use_everywheres[input.type],0];
                    }
                });
            });
            return p;
        }
	},
});
