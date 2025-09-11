import { link_is_from_subgraph_input, get_subgraph_input_type, node_graph } from "./use_everywhere_subgraph_utils.js"
import { get_real_node } from "./use_everywhere_utilities.js";
import { app } from "../../scripts/app.js";
import { i18n } from "./i18n.js";
/*
Called by onConnectionsChange for a UE_Node when side == 1 (input).

*/
export function input_changed(node, slot, connect, link_info) {
    var type = null
    if (connect && link_info) {
        if (link_is_from_subgraph_input(link_info)) { // input slot of subgraph
            type = get_subgraph_input_type(node_graph(node), link_info.origin_slot)
        } else {
            type = get_real_node(link_info.origin_id, node_graph(node))?.outputs[link_info.origin_slot]?.type
        }
    };
    type = type || '*'

    node.inputs[slot].type = type;
    if (link_info) link_info.type = type

    if (type=='*') {
        node.inputs[slot].label = i18n('anything');
        node.inputs[slot].color_on = undefined;
    } else {
        if (app.ui.settings.getSettingValue("Use Everywhere.Options.use_output_name") && link_info) {
            if (!node.inputs[slot].label || node.inputs[slot].label==i18n('anything')) {
                const out_slot = app.graph.getNodeById(link_info.origin_id)?.outputs[link_info.origin_slot]
                node.inputs[slot].label = out_slot?.label || out_slot?.localized_name || out_slot?.name || type;
            }
        } else {
            node.inputs[slot].label = type;
        }
        node.inputs[slot].color_on = app.canvas.default_connection_color_byType[type];
    }
}