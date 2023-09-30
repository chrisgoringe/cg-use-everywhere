import { app } from "../../../scripts/app.js";
import { ComfyWidgets } from "../../../scripts/widgets.js";

function add_ue(ue, type, title, input, output) {
    ue.splice(0,0,{type:type, title:title, input:input, output:output})
}

function set_label(node, label, value) {
    const the_node = app.graph._nodes_by_id[node.id.toString()];
    var detected = the_node?.widgets?.find((w)=>w.name===label);
    if (detected===undefined) {
        detected = ComfyWidgets["STRING"](the_node, label, ["STRING", { multiline: false }], app).widget;
        //detected.inputEl.readOnly = true;
        //detected.inputEl.style.opacity = 0.6;
        //detected.inputEl.style.fontSize = "9pt";
    }
    detected.value = value;
}

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
                        const origin_node = app.graph._nodes_by_id[link.origin_id.toString()];
                        const output = origin_node.outputs[link.origin_slot];
                        add_ue(use_everywheres, output.type, new RegExp(node.widgets_values[0]), new RegExp(node.widgets_values[1]), 
                                           [link.origin_id.toString(), link.origin_slot])
                        set_label(node, 'detected_type', output.type);
                    }
                }
                if (node.type === "Anything Everywhere") {
                    const in_link = node?.inputs[0].link;
                    if (in_link) {
                        const link = app.graph.links[in_link];
                        const origin_node = app.graph._nodes_by_id[link.origin_id.toString()];
                        const output = origin_node.outputs[link.origin_slot];
                        add_ue(use_everywheres, output.type, always, always, [link.origin_id.toString(), link.origin_slot])
                        set_label(node, 'detected_type', output.type);
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
