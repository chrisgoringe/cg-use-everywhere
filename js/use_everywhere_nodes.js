import { handle_bypass } from "./use_everywhere_utilities.js";

function add_ue_from_node(ues, node) {
    if (node.type === "Seed Everywhere") ues.add_ue(node, -1, "INT", [node.id.toString(),0], 
                                                    undefined, new RegExp("seed"), 5);

    if (node.type === "Anything Everywhere?") {
        const in_link = node?.inputs[0].link;
        if (in_link) {
            const type = app.graph._nodes_by_id[node.id.toString()]?.input_type[0];
            const link = handle_bypass(app.graph.links[in_link], type);
            if (link) {
                ues.add_ue(node, 0, type, [link.origin_id.toString(), link.origin_slot],
                            new RegExp(node.widgets_values[0]), 
                            new RegExp(node.widgets_values[1]), 10);
            }
        }
    }
    if (node.type === "Prompts Everywhere") {
        for (var i=0; i<2; i++) {
            const in_link = node?.inputs[i].link;
            if (in_link) {
                const type = app.graph._nodes_by_id[node.id.toString()]?.input_type[i];
                const link = handle_bypass(app.graph.links[in_link], type);
                if (link) ues.add_ue(node, i, type, [link.origin_id.toString(), link.origin_slot], undefined, new RegExp(["(^prompt|^positive)","neg"][i]), 5);
            }
        }
    }
    if (node.type === "Anything Everywhere") {
        const in_link = node?.inputs[0].link;
        if (in_link) {
            const type = app.graph._nodes_by_id[node.id.toString()]?.input_type[0];
            const link = handle_bypass(app.graph.links[in_link], type);
            if (link) ues.add_ue(node, 0, type, [link.origin_id.toString(), link.origin_slot], undefined, undefined, 2);
        }
    }
    if (node.type === "Anything Everywhere3") {
        for (var i=0; i<3; i++) {
            const in_link = node?.inputs[i].link;
            if (in_link) {
                const type = app.graph._nodes_by_id[node.id.toString()]?.input_type[i];
                const link = handle_bypass(app.graph.links[in_link],type);
                if (link) ues.add_ue(node, i, type, [link.origin_id.toString(), link.origin_slot]);
            }
        }
    }
}

export {add_ue_from_node}
