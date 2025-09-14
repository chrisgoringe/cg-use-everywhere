import { link_is_from_subgraph_input, get_subgraph_input_type, node_graph } from "./use_everywhere_subgraph_utils.js"
import { get_real_node, is_UEnode, Logger } from "./use_everywhere_utilities.js";
import { app } from "../../scripts/app.js";
import { i18n } from "./i18n.js";
import { shared } from "./shared.js";
import { reset_comboclone_on_load } from "./combo_clone.js";

function get_type(node, link_info) {
    var type = null
    if (link_info) {
        if (link_is_from_subgraph_input(link_info)) { // input slot of subgraph
            type = get_subgraph_input_type(node_graph(node), link_info.origin_slot)
        } else {
            type = get_real_node(link_info.origin_id, node_graph(node))?.outputs[link_info.origin_slot]?.type
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

    if (connect) {
        const type = get_type(node, link_info)
        if (app.ui.settings.getSettingValue("Use Everywhere.Options.use_output_name") && link_info) {
            const out_slot = node.graph.getNodeById(link_info.origin_id)?.outputs[link_info.origin_slot]
            node.inputs[slot].label = out_slot?.label || out_slot?.localized_name || out_slot?.name || i18n(type);
        } else {
            node.inputs[slot].label = i18n(type);
        }
        node.inputs[slot].color_on = app.canvas.default_connection_color_byType[type];
        node.inputs[slot].type = type
    } else {
        node.inputs[slot].label = i18n('anything');
        node.inputs[slot].color_on = undefined;       
        node.inputs[slot].type = '*'
    }
    fix_inputs(node)
}

function store_input_state(node) {
    return
    node.properties.ue_properties.input_state = []
    node.inputs.filter((inputslot)=>(inputslot.type!='*')).forEach((input)=>{
        node.properties.ue_properties.input_state.push( {
            type     : input.type,
            label    : input.label,
            color_on : input.color_on
        } )
    })
}

function restore_input_state(node) {
    return
    if (node.properties.ue_properties.input_state) {
        while (node.inputs.length < node.properties.ue_properties.input_state.length+1) add_new_input(node)
        while (node.inputs.length > node.properties.ue_properties.input_state.length+1) {
            if (!remove_excess_input(node)) return
        }
        node.properties.ue_properties.input_state.forEach((state, i) => {
            Object.assign(node.inputs[i], state)
        })
    } else {
        Logger.log_problem(`restore_input_state called for a node with no stored input state`)
    }
}

export function restore_input_states(graph) {
    graph.nodes.forEach((node) => {
        reset_comboclone_on_load(node)
        if (node.properties.ue_properties?.input_state) restore_input_state(node)
        if (is_UEnode(node)) fix_inputs(node)
        if (node.subgraph) restore_input_states(node.subgraph)
    })
}

function add_new_input(node) {
    node.properties.ue_properties.next_input_index = (node.properties.ue_properties.next_input_index || 10) + 1
    node.addInput(`anything${node.properties.ue_properties.next_input_index}`, "*", {label:i18n('anything')})
}

function remove_excess_input(node) {
    const idx = node.inputs.findIndex((inputslot)=>(inputslot.type=='*'))
    if (idx>=0) {
        try {
            Logger.log_info(`Removing excess anything input from node ${node.id}`)
            node.removeInput(idx)
            return true
        } catch (e) { Logger.log_error(e) }
    } else { Logger.log_problem(`Something very odd happened in fix_inputs for ${node.id}`) }
    return false
}

/*
This is called in various places (node load, creation, link change) to ensure there is exactly one empty input 
*/
export function fix_inputs(node) {
    if (!node.graph) return // node has been deleted prior to the fix
    if (shared.graph_being_configured) return
    if (node.properties.ue_properties.fixed_inputs) return store_input_state(node)
    

    const empty_inputs = node.inputs.filter((inputslot)=>(inputslot.type=='*'))
    var excess_inputs = empty_inputs.length - 1
    
    if (excess_inputs<0) {
        try {
            Logger.log_info(`Adding new anything input to node ${node.id}`)
            add_new_input(node)
            fix_inputs(node)
        } catch (e) {
            Logger.log_error(e)
        }
    } else if (excess_inputs>0) {
        if (remove_excess_input(node)) fix_inputs(node)
    }

    store_input_state(node)
}