import { app } from "../../scripts/app.js";
import { VERSION, version_at_least, is_UEnode, graphConverter, fix_inputs } from "./use_everywhere_utilities.js"
import { LinkRenderController } from "./use_everywhere_ui.js";

const REGEXES = ['title', 'input', 'group']
const GROUP_RESTRICTION_OPTIONS = ["No restrictions", "Send only within group", "Send only not within group"]
const COLOR_RESTRICTION_OPTIONS = ["No restrictions", "Send only to same color", "Send only to different color"]


export function can_regex(node) {
    return (node.type=="Anything Everywhere" || node.type=="Anything Everywhere?" || node.type=="Anything Everywhere3")
}

function add_row(table, header) {
    const row = document.createElement('tr')
    table.appendChild(row)
    const header_elem = document.createElement('th')
    header_elem.innerText = header
    row.appendChild(header_elem)
    return row
}

function add_cell(row, cell) {
    const td = document.createElement('td')
    row.appendChild(td)
    td.appendChild(cell)
}

function changed(node, property, value) {
    node.properties.ue_properties[property] = value
    LinkRenderController.instance().mark_link_list_outdated()
    app.canvas.setDirty(true,true)

    if (!node.properties.ue_properties.priority) {
        document.getElementById('priority_value').innerHTML = `${default_priority(node)}`
    }
}

export function edit_restrictions(a,b,c,d, node) {
    const table = document.createElement('table')
    for (var i=0; i<=2; i++) {
        const name = REGEXES[i]
        const row = add_row(table, `${name} regex`)
        const input = document.createElement('input')
        input.value = node.properties.ue_properties[`${name}_regex`] || ''
        input.addEventListener('input', ()=>{ changed(node, `${name}_regex`, input.value)})
        add_cell(row,input)
    }

    const gr_row    = add_row(table, "Group")
    const gr_select = document.createElement('select')
    add_cell(gr_row,gr_select)
    GROUP_RESTRICTION_OPTIONS.forEach((gro, i)=>{
        const gr_option = document.createElement('option')
        gr_option.value = `${i}`
        gr_option.innerText = gro
        gr_select.appendChild(gr_option)
    })
    gr_select.value = `${node.properties.ue_properties.group_restricted || 0}`
    gr_select.addEventListener('input', ()=>{ changed(node, `group_restricted`, parseInt(gr_select.value))})

    const col_row    = add_row(table, "Color")
    const col_select = document.createElement('select')
    add_cell(col_row,col_select)
    COLOR_RESTRICTION_OPTIONS.forEach((cro, i)=>{
        const col_option = document.createElement('option')
        col_option.value = `${i}`
        col_option.innerText = cro
        col_select.appendChild(col_option)
    })
    col_select.value = `${node.properties.ue_properties.color_restricted || 0}`
    col_select.addEventListener('input', ()=>{ changed(node, `color_restricted`, parseInt(col_select.value))})

    const priority_row = add_row(table,"Priority")
    const priority_value = document.createElement("span")
    priority_value.id = 'priority_value'
    priority_value.innerHTML = `${node.properties.ue_properties.priority || default_priority(node)}`
    add_cell(priority_row,priority_value)
    

    app.ui.dialog.show(table)
}

export function any_restrictions(node) {
    var restricted = (node.properties.ue_properties.group_restricted || node.properties.ue_properties.color_restricted)
    for (var i=0; i<=2; i++) {
        const reg = node.properties.ue_properties[`${REGEXES[i]}_regex`]
        restricted = restricted || (reg && reg.length>0)
    }
    return restricted
}

/*
Called whenever any node is created (before setup_ue_properties_onload).
Set node.IS_UE and 
*/
export function setup_ue_properties_oncreate(node) {
    node.IS_UE = is_UEnode(node)
    if (node.IS_UE) {
        if (graphConverter.graph_being_configured) {
            /* 
            If the graph is being configured, we are still loading old nodes. 
            These will be fixed in setup_ue_properties_onload
            */
            return;
        } else {
            /* This is a new node being created */
            if (!node.properties) node.properties = {}
            node.properties.ue_properties = {
                    version               : VERSION,
                    group_restricted      : 0,
                    color_restricted      : 0,
                    widget_ue_connectable : {},
                    title_regex           : null,
                    input_regex           : null,
                    group_regex           : null,
                    priority              : undefined,
                }
        }
    }
}

export function default_priority(node) {
    var p = 20
    if (node.type === "Seed Everywhere" || node.type === "Prompts Everywhere") p += 30
    if ((node.properties.ue_properties.title_regex && node.properties.ue_properties.title_regex!=".*") ||
        (node.properties.ue_properties.title_regex && node.properties.ue_properties.title_regex!=".*") ||
        (node.properties.ue_properties.title_regex && node.properties.ue_properties.title_regex!=".*"))  p += 80
    if (node.properties.ue_properties.group_restricted > 0) p += 1
    if (node.properties.ue_properties.color_restricted > 0) p += 3
    return p
}

/*
Convert pre 7.0 node properties when loaded.
Called after .properties has been attached to the node when reloading 
*/
export function setup_ue_properties_onload(node) {
    if (node.IS_UE) {
        if ( version_at_least(node.properties?.ue_properties?.version, "7.0") ) {
            // here we will need to add any code to convert in later version
            node.IS_UE = node.properties.ue_properties.version
        } else {
            // converting a pre 7.0 UE node
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
    }
}

/*
Functions to change Use Everywhere? and Use Everywhere3 nodes into Use Everywhere nodes
*/

export function convert_old_nodes(graph) {
    graph.nodes.filter((node)=>(node.type=="Anything Everywhere?")).forEach((node)=>{
        node.widgets.forEach((w)=>{w.hidden=true})
        if (node.title=="Anything Everywhere?") node.title = "Anything Everywhere"
        node.type = "Anything Everywhere"
    })
    graph.nodes.filter((node)=>(node.type=="Anything Everywhere3")).forEach((node)=>{
        if (node.title=="Anything Everywhere3") node.title = "Anything Everywhere"
        node.type = "Anything Everywhere"
    })
    graph.nodes.filter((node)=>(node.type=="Anything Everywhere")).forEach((node)=>{
        fix_inputs(node)
    })
    graph.nodes.filter((node)=>(node.subgraph)).forEach((node)=>{
        convert_old_nodes(node.subgraph)
    })
}
