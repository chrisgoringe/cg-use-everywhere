import { link_is_from_subgraph_input, get_subgraph_input_type } from "./use_everywhere_subgraph_utils.js"
import { get_real_node, is_UEnode, Logger } from "./use_everywhere_utilities.js";
import { app } from "../../scripts/app.js";
import { i18n } from "./i18n.js";
import { shared } from "./shared.js";
import { reset_comboclone_on_load, is_combo_clone } from "./combo_clone.js";

function get_type(graph, link_info) {
    var type = null
    if (link_info) {
        if (link_is_from_subgraph_input(link_info)) { // input slot of subgraph
            type = get_subgraph_input_type(graph, link_info.origin_slot)
        } else {
            type = get_real_node(link_info.origin_id, graph)?.outputs[link_info.origin_slot]?.type
        }
        if (type != link_info.type && link_info.type != '*') {
            Logger.log_problem(`Type detected from upstream, ${type} != type on link_info ${link_info.type}`)
        }
    } else {
        Logger.log_problem(`input_changed with connect true, graph_being_configured false, and no link_info`)
    }
    type = type || '*'
    if (type!='*' && link_info) link_info.type = type
    if (type=='*' && link_info) type = link_info.type
    return type
}


/*
Called by onConnectionsChange for a UE_Node when side == 1 (input).
*/

export function input_changed(node, slot, connect, link_info) {
    if (shared.graph_being_configured) return 
    if (!node?.inputs) return Logger.log_problem(`input_changed called but node.inputs not retrievable`)
    const in_slot = node.inputs[slot]
    if (!in_slot) return Logger.log_problem(`input_changed called for node #${node.id} slot ${slot} but that wasn't found`)
    const graph = node.graph

    if (connect) {
        const type = get_type(graph, link_info)
        if (in_slot.transient_label) {
            in_slot.label = in_slot.transient_label
        } else if (app.ui.settings.getSettingValue("Use Everywhere.Options.use_output_name") && link_info) {
            const out_slot = (link_info.origin_id==-10) ? 
                                graph.inputNode?.allSlots[link_info.origin_slot] : 
                                graph.getNodeById(link_info.origin_id)?.outputs[link_info.origin_slot]
            in_slot.label = out_slot?.label || out_slot?.localized_name || out_slot?.name || i18n(type);
        } else {
            in_slot.label = i18n(type);
        }
        in_slot.color_on = app.canvas.default_connection_color_byType[type];
        in_slot.type = type
    } else {
        in_slot.transient_label = in_slot.label
        in_slot.label = i18n('anything');
        in_slot.color_on = undefined;       
        in_slot.type = '*'
        setTimeout(()=>{in_slot.transient_label=null}, 100)
    }

}


export function post_configure_fixes(graph) {
    graph.nodes.forEach((node) => {
        if (is_combo_clone(node)) reset_comboclone_on_load(node)
        if (is_UEnode(node))      fix_inputs(node, "post_configure_fixes")
        if (node.subgraph) post_configure_fixes(node.subgraph)
    })
}

function add_new_input(node) {
    Logger.log_info(`Adding new anything input to node ${node.id} (${fix_call_message})`)
    try {
        node.properties.ue_properties.next_input_index = (node.properties.ue_properties.next_input_index || 10) + 1
        node.addInput(`anything${node.properties.ue_properties.next_input_index}`, "*", {label:i18n('anything')})
        return true
    } catch (e) { Logger.log_error(e) }
    return false
}

function remove_excess_input(node) {
    const idx = node.inputs.findIndex((inputslot)=>(inputslot.type=='*'))
    if (idx>=0) {
        try {
            Logger.log_info(`Removing excess anything input from node ${node.id} (${fix_call_message})`)
            node.removeInput(idx)
            return true
        } catch (e) { Logger.log_error(e) }
    } else { Logger.log_problem(`Something very odd happened in fix_inputs for ${node.id}`) }
    return false
}

/*
This is called in various places (node load, creation, link change) to ensure there is exactly one empty input 
*/

var fix_call_message;

function fix_star_inputs(node) {
    node.inputs.filter((input)=>(!input.link)).forEach((input)=>{
        input.type = '*'
    })
    node.inputs.filter((input)=>(input.type=='*' && input.link)).forEach((input)=>{
        const llink = node.graph.links[input.link]
        if (llink.type) input.type = llink.type
    })
}

export function fix_inputs(node, message) {
    fix_call_message = message
    if (!node.graph) return // node has been deleted prior to the fix
    if (shared.graph_being_configured) return
    if (node.properties.ue_properties.fixed_inputs) return

    fix_star_inputs(node)

    const empty_inputs = node.inputs.filter((inputslot)=>(inputslot.type=='*'))
    var excess_inputs = empty_inputs.length - 1
    
    if (excess_inputs<0) {
        if (add_new_input(node)) fix_inputs(node)
    } else if (excess_inputs>0) {
        if (remove_excess_input(node)) fix_inputs(node)
    }

}