import { handle_bypass } from "./use_everywhere_utilities.js";

function find_connected_link(node_id, input_id) {
    
}

/*
If a widget hasn't been converted, just get it's value
If it has, *try* to go upstream
*/
function get_widget_or_input_values(node_obj, widget_id) {
    if (node_obj.widgets[widget_id].type=='text') { return node_obj.widgets[widget_id].value }
    try {
        const name = node_obj.widgets[widget_id].name;
        const input = node_obj.inputs.find((input)=>input?.widget?.name==name);
        const link = app.graph.links[input.link];
        const upstream_node_obj = app.graph._nodes_by_id[link.origin_id.toString()];
        if (upstream_node_obj.widgets_values) return upstream_node_obj.widgets_values[0];
        return upstream_node_obj.widgets[0].value;
    } catch (error) {
        return "NOT CONNECTED DONT MATCH";
    }
}
/*
Add UseEverywhere broadcasts from this node to the list
*/
function add_ue_from_node(ues, node) {
    if (node.type === "Seed Everywhere") ues.add_ue(node, -1, "INT", [node.id.toString(),0], 
                                                    undefined, new RegExp("seed"), 5);

    if (node.type === "Anything Everywhere?") {
        const in_link = node?.inputs[0].link;
        const node_obj = app.graph._nodes_by_id[node.id.toString()];
        if (in_link && node_obj) {
            const w0 = get_widget_or_input_values(node_obj,0);
            const w1 = get_widget_or_input_values(node_obj,1);
            const type = node_obj.input_type[0];
            const link = handle_bypass(app.graph.links[in_link], type);
            if (link) {
                if (w1.startsWith('+')) {  // special case for Highway Nodes
                    ues.add_ue(node, 0, type, [link.origin_id.toString(), link.origin_slot],
                                new RegExp(w0), w1, 10);
                } else {
                    ues.add_ue(node, 0, type, [link.origin_id.toString(), link.origin_slot],
                                new RegExp(w0), new RegExp(w1), 10);
                }
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
