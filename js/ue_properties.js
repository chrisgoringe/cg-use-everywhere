import { VERSION, version_at_least, is_UEnode, graphConverter, fix_inputs } from "./use_everywhere_utilities.js"
import { default_regex } from "./i18n.js";

const REGEXES = ['title', 'input', 'group']

export function any_restrictions(node) {
    var restricted = (node.properties.ue_properties.group_restricted || node.properties.ue_properties.color_restricted || node.properties.ue_properties.priority)
    for (var i=0; i<=2; i++) {
        const reg = node.properties.ue_properties[`${REGEXES[i]}_regex`]
        restricted = restricted || (reg && reg.length>0)
    }
    return restricted
}

export function default_priority(node) {
    var p = 10
    if (node.type === "Seed Everywhere" || node.type === "Prompts Everywhere") p += 10
    if ((node.properties.ue_properties.title_regex && node.properties.ue_properties.title_regex!=".*") ||
        (node.properties.ue_properties.group_regex && node.properties.ue_properties.group_regex!=".*") ||
        (node.properties.ue_properties.input_regex && node.properties.ue_properties.input_regex!=".*"))  p += 20
    if (node.properties.ue_properties.group_restricted > 0) p += 3
    if (node.properties.ue_properties.color_restricted > 0) p += 6
    return p
}

const DEFAULT_PROPERTIES = {
                    version               : VERSION,
                    group_restricted      : 0,
                    color_restricted      : 0,
                    widget_ue_connectable : {},
                    title_regex           : null,
                    input_regex           : null,
                    group_regex           : null,
                    priority              : undefined,
                }

/*
Called whenever any node is created.

If the graph is still being configured, then that means the node is being created as part of a load.
In that case the properties need to be set later, in setup_ue_properties_onload
*/
export function setup_ue_properties_oncreate(node) {
    node.IS_UE = is_UEnode(node)
    if (graphConverter.graph_being_configured) return
    if (node.IS_UE) {
        if (!node.properties) node.properties = {}
        node.properties.ue_properties = {...DEFAULT_PROPERTIES}
        convert_node_types(node)
    }
}

/*
Convert node properties when loaded.
*/
export function setup_ue_properties_onload(node) {
    if (node.IS_UE) {
        if ( !version_at_least(node.properties?.ue_properties?.version, "7.0") ) {
            // convert a pre 7.0 UE node
            node.properties.ue_properties = {
                version               : VERSION,
                group_restricted      : node.properties.group_restricted,
                color_restricted      : node.properties.color_restricted,
                widget_ue_connectable : node.properties.widget_ue_connectable,
                title_regex           : node.widgets_values?.[0],
                input_regex           : node.widgets_values?.[1],
                group_regex           : node.widgets_values?.[2],
                priority              : undefined,
            }
            delete node.properties.group_restricted
            delete node.properties.color_restricted
            delete node.properties.widget_ue_connectable
        }
        convert_node_types(node)
    }
}

function convert_node_types(node) {
    if (!node.IS_UE) return

    if (node.type=="Anything Everywhere?") {
        node.widgets.forEach((w)=>{w.hidden=true})
        if (node.title=="Anything Everywhere?") node.title = "Anything Everywhere"
        node.type = "Anything Everywhere"        
    } else if (node.type=="Anything Everywhere3") {
        if (node.title=="Anything Everywhere3") node.title = "Anything Everywhere"
        node.type = "Anything Everywhere"        
    } else if (node.type=="Seed Everywhere") {
        node.properties.ue_properties.fixed_inputs = true
        node.properties.ue_properties.seed_inputs  = true
        node.properties.ue_properties.input_regex  = node.properties.ue_properties.input_regex || default_regex('seed_input_regex')        
    } else if (node.type=="Prompts Everywhere") {
        node.properties.ue_properties.fixed_inputs   = true
        node.properties.ue_properties.prompt_regexes = true
    }

    fix_inputs(node)
}
