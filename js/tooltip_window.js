
import { any_restrictions, describe_restrictions } from "./ue_properties.js";
import { app } from "../../scripts/app.js";
import { create } from "./use_everywhere_utilities.js";
import { edit_window } from "./floating_window.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { shared } from "./shared.js";

const HOVERTIME = 500
var hover_node_id = null
var mouse_pos     = [0,0]

const ue_tooltip_element = create('span', 'ue_tooltip', document.body, {id:'ue_tooltip'})

function show_tooltip(nodeover) {
    ue_tooltip_element.style.display = "block"
    ue_tooltip_element.style.left = `${mouse_pos[0]+10}px`
    ue_tooltip_element.style.top = `${mouse_pos[1]+5}px`
    ue_tooltip_element.innerHTML = ""
    ue_tooltip_element.appendChild(describe_restrictions(nodeover))
    ue_tooltip_element.showing = true
}

function show_on_hover() {
    const nodeover = app.canvas?.node_over || shared.mouseOverNode;
    if (!tooltipable(nodeover)) return

    if (mouse_pos[0]==app.canvas.mouse[0] && mouse_pos[1]==app.canvas.mouse[1]) {
        show_tooltip(nodeover)
    } else {
        maybe_show_tooltip()
    }
}

function hide_tooltip() {
    ue_tooltip_element.style.display = "none"
    ue_tooltip_element.showing = false
}

function tooltipable(nodeover) {
    if (
        (!nodeover)                                                    ||
        ( edit_window.style.display != 'none' )                              ||
        (!settingsCache.getSettingValue('Use Everywhere.Graphics.tooltips')) ||
        (!any_restrictions(nodeover))
    ) return false

    return true
}

export function maybe_show_tooltip() {
    const nodeover = app.canvas?.node_over || shared.mouseOverNode;
    if (!tooltipable(nodeover)) return hide_tooltip()

    mouse_pos = [...app.canvas.mouse]
    hover_node_id = nodeover.id
    setTimeout(show_on_hover, HOVERTIME)
}