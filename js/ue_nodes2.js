import { app } from "../../scripts/app.js";
import { titlebar_color } from "./ue_shared_ui.js";
import { node_can_broadcast } from "./use_everywhere_utilities.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { visible_graph } from "./use_everywhere_subgraph_utils.js";

const badge_size = 15
const titlebar_height = 30
const nudge = 5

export function nodes2_overlay(ctx) {
    ctx.save()
    app.canvas.ds.toCanvasContext(ctx)
    visible_graph().nodes.forEach((node) => {
        if (node.mouseOver) console.log(node.id)
        ctx.save()
        ctx.translate(node.pos[0], node.pos[1])
        n2_titlebar_additions(node, ctx)
        n2_highlight_connections(node, ctx)
        ctx.restore()
    });
    ctx.restore()
}

function n2_highlight_connections(node, ctx) {
    if (!(settingsCache.getSettingValue('Use Everywhere.Graphics.highlight') && node.inputs)) return;
    let a;
}

function n2_titlebar_additions(node, ctx) {
    if (!node_can_broadcast(node)) return;
    const color = titlebar_color(node)
    const offset_x = nudge
    const offset_y = nudge - titlebar_height 
    ctx.save(); 
    ctx.lineWidth = badge_size;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(offset_x, offset_y, badge_size/2, 0, 2*Math.PI);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    ctx.arc(offset_x, offset_y, badge_size, 0, 2*Math.PI);
    ctx.stroke();
    ctx.restore();
}
