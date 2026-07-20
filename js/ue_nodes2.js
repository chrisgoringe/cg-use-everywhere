import { app } from "../../scripts/app.js";
import { titlebar_color } from "./ue_shared_ui.js";
import { node_can_broadcast, is_able_to_broadcast, running_nodes2 } from "./use_everywhere_utilities.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { visible_graph } from "./use_everywhere_subgraph_utils.js";
import { shared } from "./shared.js";
import { Logger } from "./use_everywhere_utilities.js";
import { edit_restrictions } from "./ue_properties_editor.js";

function nodeElement(node) {
    return document.querySelector(`div[data-node-id='${node.id}']`)
}

function headerElement(node) {
    return nodeElement(node)?.querySelector(`div[data-testid="node-header-${node.id}"]`)
}

export function addMouseEvents(node) {
    Logger.log_detail(`addMouseEvents called for ${node.id}`)
    if (!running_nodes2()) return Logger.log_problem(`Not running nodes2`)
    
    const element = nodeElement(node)
    if (!element) return Logger.log_info(`Could not find node element for ${node.id}`)
    if (element._ue_mouse_events_for_nodes2_added) return Logger.log_detail(`Already added`)
    
    Logger.log_info(`adding MouseEvents for ${node.id}`)
    element.addEventListener("mouseenter", () => {
        node.mouseOver = true
        shared.mouseOverNode = node
        shared.linkRenderController.node_over_changed()
    })
    element.addEventListener("mouseleave", () => {
        node.mouseOver = false
        shared.mouseOverNode = null
        shared.linkRenderController.node_over_changed()
    })
    const header = headerElement(node)
    element.addEventListener("click", (e) => {
        if (e.detail==2) {
            if (header?.contains(e.target)) return; 
            if (node_can_broadcast(node)) {
                edit_restrictions(node)
            } 
        }
    })
    element._ue_mouse_events_for_nodes2_added = true
}

export function nodes2_overlay(ctx) {
    if (!shared.linkRenderController.ue_list) return;
    ctx.save()
    app.canvas.ds.toCanvasContext(ctx)
    visible_graph().nodes.forEach((node) => {
        n2_titlebar_additions(node, ctx)
        n2_highlight_connections(node, ctx)
        n2_widgets(node)
    });
    ctx.restore()
}

const highlight_color = "rgba(255, 255, 255, 0.8)"
const radius = 9
const blur = 5

function n2_highlight_connections(node, ctx) {
    if (!(settingsCache.getSettingValue('Use Everywhere.Graphics.highlight') 
          && node.inputs)) return;
    ctx.save()
    ctx.lineWidth   = 1
    ctx.shadowColor = "white"
    ctx.strokeStyle = highlight_color
    ctx.shadowBlur  = blur    

    const ue_list = shared.linkRenderController.ue_list

    /* highlight all connected inputs */
    ue_list.all_connected_inputs(node)
        .filter((uec)=>uec.control_node)
        .filter((uec)=>node.inputs[uec.input_index])
        .forEach((uec) => {
            const pos2 = node.getSlotPosition(uec.input_index, true)
            ctx.beginPath();
            ctx.arc(pos2[0], pos2[1], radius, 0, 2*Math.PI);
            ctx.stroke();
        });

    /* Highlight connected outputs */
    const sending_slots = ue_list.all_sending_slots(node)
    node.outputs.forEach((output,i) => {
        if (is_able_to_broadcast(node, output.name) && sending_slots.has(i)) {
            const pos2 = node.getSlotPosition(i, false);
            ctx.beginPath();
            ctx.arc(pos2[0], pos2[1], radius, 0, 2*Math.PI);
            ctx.stroke();
        }
    })

    /* Highlight inputs with ambiguities */
    ctx.lineWidth   = 2
    ctx.strokeStyle = "red"
    ctx.shadowBlur  = 0
    shared.graphAnalyser.ambiguities.filter((ambiguity)=>(ambiguity.id==node.id)).forEach((ambiguity)=>{
        const index = node.inputs.findIndex((input)=>(input.name==ambiguity.input))
        if (index>=0) {
            const pos2 = node.getSlotPosition(index, true);
            ctx.beginPath();
            ctx.moveTo(pos2[0]-radius-4,pos2[1]-radius)
            ctx.lineTo(pos2[0],pos2[1]+radius)
            ctx.moveTo(pos2[0]-radius-4,pos2[1]+radius)
            ctx.lineTo(pos2[0],pos2[1]-radius)
            ctx.stroke();
        }
    })

    ctx.restore()
}

const badge_size = 12
const titlebar_height = 30
const nudge = 5

function n2_titlebar_additions(node, ctx) {
    if (!node_can_broadcast(node)) return;
    ctx.save()
    const color = titlebar_color(node)
    const offset_x = nudge + node.pos[0]
    const offset_y = nudge - titlebar_height + node.pos[1]
    ctx.lineWidth = badge_size;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(offset_x, offset_y, badge_size/2, 0, 2*Math.PI);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    ctx.beginPath();
    ctx.arc(offset_x, offset_y, badge_size, 0, 2*Math.PI);
    ctx.stroke();
    ctx.restore()
}

function n2_widgets(node) {
    const widgets = nodeElement(node)?.querySelector("div[data-testid='node-widgets']")
    if (!widgets) return;
    const connected = shared.linkRenderController.ue_list.all_connected_inputs(node)
    Array.from(widgets.children).forEach((widget_el, index) => {
        const input_el = widget_el.querySelector("input")
        const widget   = node.widgets[index]
        if (!input_el || !widget) return;
        const wname = widget.label;
        const inputindex = node.inputs.findIndex((input)=>(input.label==wname))
        const connection = connected.find((uec)=>(uec.input_index==inputindex))
        input_el.disabled = !!connection 
    })
}
