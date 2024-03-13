import { Logger, get_real_node, get_group_node, get_all_nodes_within } from "./use_everywhere_utilities.js";
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
    const color = get_real_node(node_id).color;
    if (already_limited_to) {
        already_limited_to.forEach((nid) => {
            if (get_real_node(nid).color==color) nodes_in.add(nid)
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
    const node = get_real_node(id);
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
    static _instance;
    static instance(tga) {
        if (!this._instance) this._instance = new LinkRenderController();
        if (tga && !this._instance.the_graph_analyser) this._instance.the_graph_analyser = tga;
        return this._instance
    }
    constructor() {
        this.the_graph_analyser = null;
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
        this.the_graph_analyser.analyse_graph().then(this.reload_resolve, this.reload_reject); // an async call is a promise; pass it two callbacks
        Logger.log(Logger.INFORMATION, "link list update started");
    } 

    async toggle_ue_links_visible() {
        this._ue_links_visible = !this._ue_links_visible;
        Logger.log(Logger.INFORMATION, `toggle ue links visible ${this._ue_links_visible}`);
        app.graph.setDirtyCanvas(true,true);
    }

    highlight_ue_connections(node, ctx) {
        if (!app.ui.settings.getSettingValue('AE.highlight', true)) return;
        //if (this._ue_links_visible) return;
        if (!this.list_ready()) return;

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

    list_ready() {
        if (!this.the_graph_analyser) return false;
        if (this.ue_list===undefined) this.request_link_list_update();
        return !this.ue_list_reloading
    }

    render_mouseover(node, ctx) {
        if (this._ue_links_visible) return; // already showing all links
        if (!app.ui.settings.getSettingValue('AE.mouseover')) return; //mouseover is off
        if (!this.list_ready()) return;
        ctx.save();
        ctx.translate(-node.pos[0], -node.pos[1]);
        get_all_nodes_within(node.id).forEach((anode) => {
            this.ue_list.all_ue_connections_for(anode.id).forEach((ue_connection) => this.render_ue_link(ue_connection, ctx));
        })
        this.ue_list.all_ue_connections_for(node.id).forEach((ue_connection) => this.render_ue_link(ue_connection, ctx));
        ctx.restore();
    }

    render_all_ue_links(ctx) {
        if (!this._ue_links_visible) return;    // switched off
        if (!this.list_ready()) return;
        // can we repeat this after a second or something?
        this.ue_list.all_ue_connections().forEach((ue_connection) => this.render_ue_link(ue_connection, ctx));
    }

    render_ue_link(ue_connection, ctx) {
        const node = get_real_node(ue_connection.sending_to.id);

        /* this is the end node; get the position of the input */
        var pos2 = node.getConnectionPos(true, ue_connection.input_index, this.slot_pos1);

        /* get the position of the *input* that is being echoed - except for the Seed Anywhere node, 
        which is displayed with an output: the class records control_node_input_index as -ve (-1 => 0, -2 => 1...) */
        const input_source = (ue_connection.control_node_input_index >= 0); 
        const source_index = input_source ? ue_connection.control_node_input_index : -1-ue_connection.control_node_input_index;
        const pos1 = get_group_node(ue_connection.control_node.id).getConnectionPos(input_source, source_index, this.slot_pos2);    

        /* get the direction that we start and end */
        const delta_x = pos2[0] - pos1[0];
        const delta_y = pos2[1] - pos1[1];
        const end_direction = LiteGraph.LEFT; // always end going into an input
        const sta_direction = ((Math.abs(delta_y) > Math.abs(delta_x))) ? 
                                    ((delta_y>0) ? LiteGraph.DOWN : LiteGraph.UP) : 
                                    ((input_source && delta_x<0) ? LiteGraph.LEFT : LiteGraph.RIGHT)

        const color = LGraphCanvas.link_type_colors[ue_connection.type];
        ctx.save();
        //ctx.shadowColor = "white";
        //ctx.shadowBlur = 1;
        const animate = (app.ui.settings.getSettingValue('AE.animate', true)) ? 1 : 0;
        app.canvas.renderLink(ctx, pos1, pos2, undefined, true, animate, color, sta_direction, end_direction, undefined);
        ctx.restore();
    }
}

export {displayMessage, update_input_label, nodes_in_my_group, nodes_in_groups_matching, nodes_my_color, indicate_restriction}
export{ LinkRenderController}