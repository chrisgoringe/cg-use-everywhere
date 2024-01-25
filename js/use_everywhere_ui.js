import { Logger } from "./use_everywhere_utilities.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";

function nodes_in_my_group(node_id) {
    const nodes_in = new Set();
    app.graph._groups.forEach((group) => {
        group.recomputeInsideNodes();
        if (group._nodes?.find((node) => { return (node.id===node_id) } )) {
            group._nodes.forEach((node) => { nodes_in.add(node.id) } )
        }
    });
    return [...nodes_in];
}

function nodes_in_groups_matching(regex, already_limited_to) {
    const nodes_in = new Set();
    app.graph._groups.forEach((group) => {
        if (regex.test(group.title)) {
            group.recomputeInsideNodes();
            group._nodes.forEach((node) => { 
                if (!already_limited_to || already_limited_to.contains(node.id)) {
                    nodes_in.add(node.id) 
                }
            } );
        }
    });
    return [...nodes_in];
}


function nodes_my_color(node_id, already_limited_to) {
    const nodes_in = new Set();
    const color = app.graph._nodes_by_id[node_id].color;
    if (already_limited_to) {
        already_limited_to.forEach((nid) => {
            if (app.graph._nodes_by_id[nid].color==color) nodes_in.add(nid)
        })
    } else {
        app.graph._nodes.forEach((node) => {
            if (node.color==color) nodes_in.add(node.id)
        })
    }
    return [...nodes_in];
}

function indicate_restriction(ctx, title_height) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#6F6";
    ctx.beginPath();
    ctx.roundRect(5,5-title_height,20,20,8);
    ctx.stroke();
    ctx.restore();
}

function displayMessage(id, message) {
    const node = app.graph._nodes_by_id[id];
    if (!node) return;
    var w = node.widgets?.find((w) => w.name === "display_text_widget");
    if (app.ui.settings.getSettingValue('AE.details', false) || w) {
        if (!w) {
            w = ComfyWidgets["STRING"](this, "display_text_widget", ["STRING", { multiline: true }], app).widget;
            w.inputEl.readOnly = true;
            w.inputEl.style.opacity = 0.6;
            w.inputEl.style.fontSize = "9pt";
        }
        w.value = message;
        this.onResize?.(this.size);
    }
}

function update_input_label(node, slot, app) {
    if (node.input_type[slot]) {
        node.inputs[slot].name = node.input_type[slot];
        node.inputs[slot].color_on = app.canvas.default_connection_color_byType[node.input_type[slot]];
    } else {
        node.inputs[slot].name = "anything";
        node.inputs[slot].color_on = undefined;
    }
}

class LinkRenderController {
// a reference to the method that we can use to calculate links
    the_graph_analyser;
    constructor(graph_analyser) {
        this.the_graph_analyser = graph_analyser;
    }

    _ue_links_visible = false;  // toggle whether to show virtual links
    ue_list = undefined;        // a UseEverythingList; undefined when outdated
    ue_list_reloading = false;  // true when a reload has been requested but not completed

    // memory reuse
    slot_pos1 = new Float32Array(2); //to reuse
    slot_pos2 = new Float32Array(2); //to reuse

    ue_links_visible() {
        return this._ue_links_visible;
    }

    mark_link_list_outdated() {
        if (this.ue_list) {
            this.ue_list = undefined;
            this.request_link_list_update();
            Logger.log(Logger.INFORMATION, "link_list marked outdated");
        } else {
            Logger.log(Logger.INFORMATION, "link_list was already outdated");
        }
    }

    // callback when the_graph_analyser finishes - store the result and note reloading is false
    reload_resolve = function (value) {
        this.ue_list_reloading=false;
        this.ue_list = value;
        Logger.log(Logger.INFORMATION, "link list update completed");
        Logger.log_call(Logger.DETAIL, this.ue_list.print_all);
        if (this._ue_links_visible) app.graph.setDirtyCanvas(true,true);
    }.bind(this)

    // callback for when the_graph_analyser fails - note reloading is false and log
    reload_reject = function(reason) {
        this.ue_list_reloading=false;
        Logger.log(Logger.ERROR, "link list update failed");
        Logger.log_error(Logger.ERROR, reason);
    }.bind(this)

    // request an update to the ue_list. 
    request_link_list_update() {
        if (this.ue_list_reloading) return;                            // already doing it
        this.ue_list_reloading = true;                                 // stop any more requests
        this.the_graph_analyser().then(this.reload_resolve, this.reload_reject); // an async call is a promise; pass it two callbacks
        Logger.log(Logger.INFORMATION, "link list update started");
    } 

    async toggle_ue_links_visible() {
        this._ue_links_visible = !this._ue_links_visible;
        Logger.log(Logger.INFORMATION, `toggle ue links visible ${this._ue_links_visible}`);
        app.graph.setDirtyCanvas(true,true);
    }

    highlight_ue_connections(node, ctx) {
        this.ue_list.all_connected_inputs(node).forEach((ue_connection) => {
            if (!ue_connection.control_node) { // control node deleted...
                this.mark_link_list_outdated();
                return; 
            }
            var pos2 = node.getConnectionPos(true, ue_connection.input_index, this.slot_pos1);
            pos2[0] -= node.pos[0];
            pos2[1] -= node.pos[1];
            ctx.save();
            ctx.lineWidth = 1;
            var radius=5
            ctx.strokeStyle = LGraphCanvas.link_type_colors[ue_connection.type];
            ctx.shadowColor = "white"; 
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.beginPath();
            ctx.roundRect(pos2[0]-radius,pos2[1]-radius,2*radius,2*radius,radius);
            ctx.stroke();
            ctx.beginPath();
            ctx.strokeStyle = "black";
            ctx.shadowBlur = 0;
            radius = radius - 1;
            ctx.roundRect(pos2[0]-radius,pos2[1]-radius,2*radius,2*radius,radius);
            ctx.stroke();

            ctx.restore();
        });
    }

    render_ue_links(node, ctx) {
        
        const animate = (app.ui.settings.getSettingValue('AE.animate', true)) ? 1 : 0;
        if (this.ue_list===undefined) {
            this.request_link_list_update();    // list is out of date - ask for a new one
        }
        if (this.ue_list_reloading) return;     // if we don't have one, return. This method gets called frequently!

        if (app.ui.settings.getSettingValue('AE.highlight', true)) {
            this.highlight_ue_connections(node, ctx)
        }

        if (!(this._ue_links_visible || app.ui.settings.getSettingValue('AE.mouseover'))) return;    // switched off

        this.ue_list.all_connected_inputs(node).forEach((ue_connection) => {
            if (!ue_connection.control_node) { // control node deleted...
                this.mark_link_list_outdated();
                return; 
            }

            if (this._ue_links_visible || node.mouseOver || ue_connection.control_node.mouseOver) {
                /* we're on the end node; get the position of the input */
                var pos2 = node.getConnectionPos(true, ue_connection.input_index, this.slot_pos1);

                /* get the position of the *input* that is being echoed - except for the Seed Anywhere node, 
                which is displayed with an output: the class records control_node_input_index as -ve (-1 => 0, -2 => 1...) */
                const input_source = (ue_connection.control_node_input_index >= 0); 
                const source_index = input_source ? ue_connection.control_node_input_index : -1-ue_connection.control_node_input_index;
                const pos1 = ue_connection.control_node.getConnectionPos(input_source, source_index, this.slot_pos2);    
                
                /* our drawing context is relative to the node we are on, so shift */
                pos2[0] -= node.pos[0];
                pos2[1] -= node.pos[1];
                pos1[0] -= node.pos[0];
                pos1[1] -= node.pos[1];

                /* get the direction that we start and end */
                const delta_x = pos2[0] - pos1[0];
                const delta_y = pos2[1] - pos1[1];
                const end_direction = LiteGraph.LEFT; // always end going into an input
                const sta_direction = ((Math.abs(delta_y) > Math.abs(delta_x))) ? 
                                            ((delta_y>0) ? LiteGraph.DOWN : LiteGraph.UP) : 
                                            ((input_source && delta_x<0) ? LiteGraph.LEFT : LiteGraph.RIGHT)

                const color = LGraphCanvas.link_type_colors[ue_connection.type];
                ctx.save();
                ctx.shadowColor = "red";
                ctx.shadowBlur = 15;
                app.canvas.renderLink(ctx, pos1, pos2, undefined, true, animate, color, sta_direction, end_direction, undefined);
                ctx.restore();
            }
        })
    }
}

export {displayMessage, update_input_label, nodes_in_my_group, nodes_in_groups_matching, nodes_my_color, indicate_restriction}
export{ LinkRenderController}