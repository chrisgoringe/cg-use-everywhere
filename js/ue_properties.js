import { version_at_least, create, is_UEnode } from "./use_everywhere_utilities.js"
import { i18n, i18n_functional, GROUP_RESTRICTION_OPTIONS, COLOR_RESTRICTION_OPTIONS } from "./i18n.js";
import { shared } from "./shared.js";
import { fix_inputs } from "./connections.js";
import { VERSION } from "./shared.js";

const ALL_REGEXES = ['title', 'input', 'prompt', 'negative', 'group']

function any_regex_restrictions(node) {
    if (!node.properties.ue_properties) return false
    var restricted = false
    ALL_REGEXES.forEach((r)=>{
        const reg = node.properties.ue_properties[`${r}_regex`]
        restricted = restricted || (reg && reg.length>0)        
    })
    return restricted
}

export function any_restrictions(node) {
    return (
        node.properties.ue_properties?.group_restricted || 
        node.properties.ue_properties?.color_restricted || 
        node.properties.ue_properties?.priority         || 
        any_regex_restrictions(node)
    )
}

export function describe_restrictions(node) {
    const statements = []
    if (node.properties.ue_properties) {
        ALL_REGEXES.forEach((r)=>{
            var reg = node.properties.ue_properties[`${r}_regex`]    
            if (reg && reg.length>0) {
                const condition = i18n((node.properties.ue_properties[`${r}_regex_invert`]) ? i18n("not match"): i18n("match"))
                statements.push([`${i18n(r)} regex`, `${condition} ${reg}`])    
            }
        })
        if (node.properties.ue_properties.group_restricted) statements.push([i18n('group'),i18n(GROUP_RESTRICTION_OPTIONS[node.properties.ue_properties.group_restricted])])
        if (node.properties.ue_properties.color_restricted) statements.push([i18n('color'),i18n(COLOR_RESTRICTION_OPTIONS[node.properties.ue_properties.color_restricted])])
    }
    if (node.properties.ue_properties.priority !== undefined) statements.push([i18n('priority'), node.properties.ue_properties.priority])  
    const table = create('table')
    statements.forEach((s)=>{
        const row = create('tr', null, table)
        create('th', null, row, {innerText:`${i18n(s[0], {titlecase:true})}:`})
        create('td', null, row, {innerText:s[1]})
    })
    return table
}

export function default_priority(node) {
    var p = 10
    if (node.type === "Seed Everywhere" || node.type === "Prompts Everywhere") p += 10
    if (any_regex_restrictions(node))  p += 20
    if (node.properties.ue_properties.group_restricted > 0) p += 3
    if (node.properties.ue_properties.color_restricted > 0) p += 6
    return p
}

const DEFAULT_PROPERTIES = {
                    version               : VERSION,
                    group_restricted      : 0,
                    color_restricted      : 0,
                    widget_ue_connectable : {},
                    input_ue_unconnectable : {},
                    title_regex           : null,
                    input_regex           : null,
                    group_regex           : null,
                    title_regex_invert    : false,
                    input_regex_invert    : false,
                    group_regex_invert    : false,
                    priority              : undefined,
                    repeated_type_rule    : 0,
                    string_to_combo       : 0,
                }

/*
Called whenever any node is created.

If the graph is still being configured, then that means the node is being created as part of a load.
In that case the properties need to be set later, in setup_ue_properties_onload
*/
export function setup_ue_properties_oncreate(node) {
    if (shared.graph_being_configured) return
    if (!node.properties) node.properties = {}
    node.properties.ue_properties = {...DEFAULT_PROPERTIES}
    convert_node_types(node)
}

/*
Convert node properties when loaded.
*/
export function setup_ue_properties_onload(node) {
    if (!node.properties?.ue_properties) node.properties.ue_properties = {}
    if ( !version_at_least(node.properties?.ue_properties?.version, "7.0") ) {
        if (is_UEnode(node, false)) {
        // convert a pre 7.0 UE node
            node.properties.ue_properties = {
                version               : VERSION,
                group_restricted      : node.properties.group_restricted,
                color_restricted      : node.properties.color_restricted,
                widget_ue_connectable : node.properties.widget_ue_connectable,
                input_ue_unconnectable: {},
                title_regex           : node.widgets_values?.[0],
                input_regex           : node.widgets_values?.[1],
                group_regex           : node.widgets_values?.[2],
                priority              : undefined,
            }
            delete node.properties.group_restricted
            delete node.properties.color_restricted
            delete node.properties.widget_ue_connectable
        } else {
            node.properties.ue_properties.version = VERSION
            node.properties.ue_properties.widget_ue_connectable = node.properties.ue_properties.widget_ue_connectable || 
                                                                  node.properties.widget_ue_connectable ||
                                                                  {}
            node.properties.ue_properties.input_ue_unconnectable = {}
            if (node.properties.widget_ue_connectable) delete node.properties.widget_ue_connectable            
        }
    }
    convert_node_types(node)

}

function convert_node_types(node) {
    if (!is_UEnode(node, false)) return

    if (node.type=="Anything Everywhere?") {
        node.widgets.forEach((w)=>{w.hidden=true})
        if (node.title=="Anything Everywhere?") node.title = "Anything Everywhere"
        node.type = "Anything Everywhere"        
    } else if (node.type=="Anything Everywhere3") {
        if (node.title=="Anything Everywhere3") node.title = "Anything Everywhere"
        node.type = "Anything Everywhere"        
    } else if (node.type=="Seed Everywhere") {
        node.type = "PrimitiveInt"
        node.properties.ue_convert = true
        node.properties.ue_properties.fixed_inputs = true
        node.properties.ue_properties.seed_inputs  = true
        node.properties.ue_properties.input_regex  = node.properties.ue_properties.input_regex || i18n_functional('seed_input_regex')   
    } else if (node.type=="Prompts Everywhere") {
        node.properties.ue_properties.fixed_inputs   = true
        node.properties.ue_properties.prompt_regexes = true
    }

    ALL_REGEXES.forEach((r)=>{
        const rname = `${r}_regex`
        if (node.properties.ue_properties[rname]==".*") node.properties.ue_properties[rname] = undefined
    })

    fix_inputs(node, "convert_node_types")
}
