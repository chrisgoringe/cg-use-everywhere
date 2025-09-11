import { shared } from "./shared.js"

function update_my_widget(node) {
    node.widgets[0].options.values = [...node.properties.comboclone]
}

export function reset_comboclone_on_load(node) {
    if (node.properties?.comboclone) update_my_widget(node)
}

export function comboclone_on_connection(node, link_info) {
    if (shared.graph_being_configured) return
    const target_node = app.graph.getNodeById(link_info.target_id)
    const input_name = target_node?.inputs[link_info.target_slot].name
    const widget = target_node?.widgets?.find((w)=>(w.name==input_name))
    
    if (widget?.type=="combo" && widget?.options?.values) {
        node.properties.comboclone = [...widget.options.values];
        update_my_widget(node)
        node.widgets[0].value = widget.value
    }
}