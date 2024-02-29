import { app } from "../../scripts/app.js";
import { is_UEnode, get_real_node } from "./use_everywhere_utilities.js";


function _convert_to_links(ue) {
    const output_node_id = ue.output[0];
    const output_index = ue.output[1];
    const output_node = get_real_node(output_node_id);
    ue.sending_to.forEach((st) => {
        const input_node_id = st.node.id;
        const input_node = get_real_node(input_node_id);
        const input_index = st.input_index;
        output_node.connect(output_index, input_node, input_index);
    });
}

function convert_to_links(ues, control_node_id) {
    ues.ues.forEach((ue)=> {
        if (control_node_id==-1 || ue.controller.id == control_node_id) _convert_to_links(ue);
    });
}

function remove_all_ues() {
    var match = app.graph._nodes.find((node)=>is_UEnode(node));
    while (match) {
        app.graph.remove(match);
        match = app.graph._nodes.find((node)=>is_UEnode(node));
    }
}

export {convert_to_links, remove_all_ues}