function add_ue_from_node(ues, node) {
        /* this section deprecated: remove in V4 */
    if (node.type.startsWith('UE ')) {
        if (node.inputs) {
            for (var i=0; i<node.inputs.length; i++) {
                if (node.inputs[i].link != null) ues.add_ue(node, i, node.inputs[i].type, [node.id.toString(),i]);
            }
        } else ues.add_ue(node, 0, node.type.substring(3), [node.id.toString(),0]);
    }

    if (node.type.startsWith('UE? ')) {
        if (node.inputs) {
            for (var i=0; i<node.inputs.length; i++) {
                if (node.inputs[i].link != null) {
                    ues.add_ue(node, i, node.inputs[i].type, [node.id.toString(),i], 
                                new RegExp(node.widgets_values[0]), 
                                new RegExp(node.widgets_values[1]), 10);
                }
            }
        } else {
            ues.add_ue(node, 0, node.type.substring(4), [node.id.toString(),0], 
                        new RegExp(node.widgets_values[1]), 
                        new RegExp(node.widgets_values[2]), 10);
        }
    }
    /* end of deprecated section */
    if (node.type === "Seed Everywhere") ues.add_ue(node, -1, "INT", [node.id.toString(),0], 
                                                    undefined, new RegExp("seed"), 5);

    if (node.type === "Anything Everywhere?") {
        const in_link = node?.inputs[0].link;
        if (in_link) {
            const link = app.graph.links[in_link];
            const type = app.graph._nodes_by_id[node.id.toString()].input_type;
            if (type) {
                ues.add_ue(node, 0, type, [link.origin_id.toString(), link.origin_slot],
                            new RegExp(node.widgets_values[0]), 
                            new RegExp(node.widgets_values[1]), 10);
            }
        }
    }
    if (node.type === "Anything Everywhere") {
        const in_link = node?.inputs[0].link;
        if (in_link) {
            const link = app.graph.links[in_link];
            const type = app.graph._nodes_by_id[node.id.toString()].input_type;
            if (type) ues.add_ue(node, 0, type, [link.origin_id.toString(), link.origin_slot]);
        }
    }
}

export {add_ue_from_node}
