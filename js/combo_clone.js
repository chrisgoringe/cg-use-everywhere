import { shared } from "./shared.js"
import { Logger } from "./use_everywhere_utilities.js"

function update_me(node) {
    if (node.properties.comboclone) {
        Logger.log_problem(`Reseting combo clone node ${node.id}`)
        node.widgets[0].options.values = [...node.properties.comboclone.options]
        node.outputs[0].type = "COMBO"
        node.outputs[0].label = node.properties.comboclone.name
    }
}

export function is_combo_clone(node) {
    return (node.type == "Combo Clone")
}

export function reset_comboclone_on_load(node) {
    if (is_combo_clone(node)) update_me(node)
}

export function comboclone_on_connection(node, link_info, connect) {
    if (!is_combo_clone(node)) return Logger.log_problem(`comboclone_on_connection called for node ${node.id} of type ${node.type}`)
    if (shared.graph_being_configured) return
    if (connect) {
        if (!link_info) return
        const target_node = node.graph.getNodeById(link_info.target_id)
        const input_name = target_node?.inputs[link_info.target_slot].name
        const widget = target_node?.widgets?.find((w)=>(w.name==input_name))
        
        if (widget?.type=="combo" && widget?.options?.values) {
            node.properties.comboclone = {
                options : [...widget.options.values],
                name    : input_name
            }
            update_me(node)
            node.widgets[0].value = widget.value
            link_info.type = "COMBO"
        }
    } else {
        // no action when we disconnect
    }
}