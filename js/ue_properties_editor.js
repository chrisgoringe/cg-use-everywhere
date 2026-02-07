import { i18n, i18n_functional, GROUP_RESTRICTION_OPTIONS, COLOR_RESTRICTION_OPTIONS, REPEATED_TYPE_OPTIONS } from "./i18n.js";
import { app } from "../../scripts/app.js";
import { default_priority } from "./ue_properties.js";
import { edit_window } from "./floating_window.js";
import { shared } from "./shared.js";
import { Logger } from "./use_everywhere_utilities.js";

const REGEXES = ['title', 'input', 'group']
const P_REGEXES = ['prompt', 'negative']

function create_element(tag, parent, options={}) {
    const elem = document.createElement(tag)
    if (parent) parent.appendChild(elem)
    Object.assign(elem, options)
    return elem
}

export function edit_restrictions(a,b,c,d, node) { // a,b,c,d parameters are ignored - called from menu system
    edit_window.set_body(create_editor_html(node))
    edit_window.set_title(`Restrictions for node #${node.id}`)
    edit_window.maybe_move_to(app.canvas.mouse[0]+10, app.canvas.mouse[1]+10)
    edit_window.show()
}

function add_row(table, header) {
    const row = document.createElement('div')
    row.className = 'ue_properties_row'
    table.appendChild(row)
    const header_elem = document.createElement('span')
    header_elem.className = 'ue_properties_title'
    header_elem.innerText = header
    row.appendChild(header_elem)
    return row
}

function add_cell(row, cell) {
    const td = document.createElement('span')
    td.className = 'ue_properties_cell'
    row.appendChild(td)
    td.appendChild(cell)
}

function changed(node, property, value) {
    node.properties.ue_properties[property] = value

    if (!node.properties.ue_properties.priority) {
        document.getElementById('priority_value').value = `${default_priority(node)}`
    }

    const elem = document.getElementById(`${property}_value`)
    if (elem) elem.style.opacity = (value) ? "1" : "0.5"

    shared.linkRenderController.mark_link_list_outdated()
    app.canvas.setDirty(true,true)
}

function create_editor_html(node) {
    const table = document.createElement('div')
    table.className = 'ue_properties_table'

    for (var i=0; i<=2; i++) {
        const name = REGEXES[i]
        const row = add_row(table, `${i18n(name)} regex`)

        const contents = create_element('span', null, {'className':'regex_input_container'})

        const checkbox_props = {
            type:'checkbox', 
            id:`${name}_regex_invert`, 
            checked: (node.properties.ue_properties[`${name}_regex_invert`]) ? true : undefined,
            className: 'checkbox'
        }
        create_element('input', contents, checkbox_props).
            addEventListener('input', (e)=>{ changed(node, `${name}_regex_invert`, e.target.checked); } )

        create_element('span', contents, {innerText:i18n('Invert'), className:'regex_checkbox_label'})

        create_element('input', contents, {type:'text', value:node.properties.ue_properties[`${name}_regex`] || ''}). 
            addEventListener('input', (e)=>{ changed(node, `${name}_regex`, e.target.value)})

        if (i==2) { row.classList.add('break_below') }

        add_cell(row,contents)
    }

    const gr_row    = add_row(table, i18n("Group"))
    const gr_select = document.createElement('select')
    add_cell(gr_row,gr_select)
    add_select_options(node, gr_select, GROUP_RESTRICTION_OPTIONS, `group_restricted`)

    const col_row    = add_row(table, i18n("Color"))
    const col_select = document.createElement('select')
    add_cell(col_row,col_select)
    add_select_options(node, col_select, COLOR_RESTRICTION_OPTIONS, `color_restricted` )
    col_row.classList.add('break_below')

    const repeated_type_row = add_row(table, i18n("Repeated Types"))
    const repeated_type_select = document.createElement('select')
    add_cell(repeated_type_row,repeated_type_select)
    add_select_options(node, repeated_type_select, REPEATED_TYPE_OPTIONS, `repeated_type_rule`)

    const apply_to_unrepeated_row = add_row(table, i18n("Apply to Unrepeated"))
    const apply_to_unrepeated_select = document.createElement('select')
    add_cell(apply_to_unrepeated_row, apply_to_unrepeated_select)
    add_select_options(node, apply_to_unrepeated_select, ["no", "yes"], `apply_to_unrepeated`)
    apply_to_unrepeated_row.classList.add('break_below')

    if (node.inputs.find((i)=>(i.type=="STRING"))) {
        const send_to_combos_row = add_row(table, i18n("String to Combos"))
        const send_to_combos_select = document.createElement('select')
        add_cell(send_to_combos_row, send_to_combos_select)
        add_select_options(node, send_to_combos_select, ["no", "yes"], `string_to_combo`)
        send_to_combos_row.classList.add('break_below')
    }

    const send_to_any_row = add_row(table, i18n("Send to Any"))
    const send_to_any_select = document.createElement('select')
    add_cell(send_to_any_row, send_to_any_select)
    add_select_options(node, send_to_any_select, ["no", "yes"], `send_to_any`)
    send_to_any_row.classList.add('break_below')

    const priority_row = add_row(table, i18n("Priority"))
    const priority_edit = document.createElement("input")
    priority_edit.value = `${node.properties.ue_properties.priority || default_priority(node)}`
    priority_edit.addEventListener('input', ()=>{ 
        const p = parseInt(priority_edit.value)
        if (p) changed(node, `priority`, p)
        if (priority_edit.value=='') changed(node, `priority`, undefined)
    })
    priority_edit.id = 'priority_value'
    if (!node.properties.ue_properties.priority) priority_edit.style.opacity = 0.5
    add_cell(priority_row,priority_edit)
    priority_row.classList.add('break_below')

    return table
}

function add_select_options(node, select, OPTIONS, property) {
    OPTIONS.forEach((txt, i)=>{
        const option = document.createElement('option')
        option.value = `${i}`
        option.innerText = txt
        select.appendChild(option)
    })
    select.value = `${node.properties.ue_properties[property] || 0}`
    select.addEventListener('input', ()=>{ changed(node, property, parseInt(select.value))})
}