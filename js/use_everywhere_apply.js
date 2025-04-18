import { app } from "../../scripts/app.js";
import { display_name } from "./use_everywhere_classes.js";
import { is_UEnode, get_real_node, Logger } from "./use_everywhere_utilities.js";


function _convert_to_links(ue, added_links) {
    const output_node_id = ue.output[0];
    const output_index = ue.output[1];
    const output_node = get_real_node(output_node_id);
    Logger.log(Logger.INFORMATION, "Adding links for " + ue.description);
    ue.sending_to.forEach((st) => {
        const input_node_id = st.node.id;
        const input_node = get_real_node(input_node_id);
        const input_index = st.input_index;
        const new_link = output_node.connect(output_index, input_node, input_index);
        if (!new_link)
            console.error("Failed to connect nodes: " +
                          `${output_node_id}[${output_index}] -> ` +
                          `${input_node_id}[${input_index}].`);
        else { // Memorize the links we are adding to remove them later
            if (added_links)
                added_links.push(new_link.id);
            Logger.log(Logger.INFORMATION, `  -> ${display_name(st.node)}, ${st.input.name} ` +
                                           `(${st.node.id}.${st.input_index}) (ID: ${new_link.id})`);
        }
    });
}

function convert_to_links(ues, control_node_id, added_links=undefined) {
    ues.ues.forEach((ue)=> {
        if (control_node_id==-1 || ue.controller.id == control_node_id) _convert_to_links(ue, added_links);
    });
    return added_links;
}

function remove_all_ues() {
    var match = app.graph._nodes.find((node)=>is_UEnode(node));
    while (match) {
        app.graph.remove(match);
        match = app.graph._nodes.find((node)=>is_UEnode(node));
    }
}

export {convert_to_links, remove_all_ues}