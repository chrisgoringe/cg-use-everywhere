import { LinkRenderController } from "./use_everywhere_ui.js";
import { i18n } from "./i18n.js";
import { app } from "../../scripts/app.js";
import { default_priority } from "./ue_properties.js";

const REGEXES = ['title', 'input', 'group']
const GROUP_RESTRICTION_OPTIONS = ["No restrictions", "Send only within group", "Send only not within group"]
const COLOR_RESTRICTION_OPTIONS = ["No restrictions", "Send only to same color", "Send only to different color"]

export function edit_restrictions(a,b,c,d, node) {
    const table = create_editor_html(node)
    app.ui.dialog.show(table)
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

    if (!node.properties.ue_properties.priority) {
        document.getElementById('priority_value').value = `${default_priority(node)}`
        document.getElementById('priority_value').style.opacity = "0.5"
    } else {
        document.getElementById('priority_value').style.opacity = "1"
    }

    LinkRenderController.instance().mark_link_list_outdated()
    app.canvas.setDirty(true,true)
}

export function create_editor_html(node) {
    const table = document.createElement('table')

    for (var i=0; i<=2; i++) {
        const name = REGEXES[i]
        const row = add_row(table, `${i18n(name)} regex`)
        if (i==1 && node.properties.ue_properties.prompt_regexes) {
            const input = document.createElement('span')
            input.innerText = i18n('prompt_regexes_text')
            add_cell(row,input)
        } else {
            const input = document.createElement('input')
            input.value = node.properties.ue_properties[`${name}_regex`] || ''
            input.addEventListener('input', ()=>{ changed(node, `${name}_regex`, input.value)})
            add_cell(row,input)
        }
    }

    const gr_row    = add_row(table, i18n("Group"))
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

    const col_row    = add_row(table, i18n("Color"))
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
    return table
}