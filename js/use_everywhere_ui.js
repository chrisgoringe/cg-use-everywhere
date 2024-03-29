import { Logger, get_real_node, get_group_node, get_all_nodes_within } from "./use_everywhere_utilities.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";

function nodes_in_my_group(node_id) {
    const nodes_in = new Set();
    app.graph._groups.forEach((group) => {
        if (!app.canvas.selected_group_moving) group.recomputeInsideNodes();
        if (group._nodes?.find((node) => { return (node.id===node_id) } )) {
            group._nodes.forEach((node) => { nodes_in.add(node.id) } )
        }
    });
    return [...nodes_in];
}

function nodes_not_in_my_group(node_id) {
    const nid = nodes_in_my_group(node_id);
    const nodes_not_in = [];
    app.graph._nodes.forEach((node) => {
        if (!nid.includes(node.id)) nodes_not_in.push(node.id);
    });
    return nodes_not_in;
}

function nodes_in_groups_matching(regex, already_limited_to) {
    const nodes_in = new Set();
    app.graph._groups.forEach((group) => {
        if (regex.test(group.title)) {
            if (!app.canvas.selected_group_moving) group.recomputeInsideNodes();
            /* 
            Note for optimisation - it would be more efficient to calculate what nodes are in what groups
            once at the start of analyse_graph() rather than for every group for every UE? with a group regex.
            */
            group._nodes.forEach((node) => { 
                if (!already_limited_to || already_limited_to.includes(node.id)) {
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

function nodes_not_my_color(node_id, already_limited_to) {
    const nodes_in = new Set();
    const color = get_real_node(node_id).color;
    if (already_limited_to) {
        already_limited_to.forEach((nid) => {
            if (get_real_node(nid).color!=color) nodes_in.add(nid)
        })
    } else {
        app.graph._nodes.forEach((node) => {
            if (node.color!=color) nodes_in.add(node.id)
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
        this.periodically_mark_link_list_outdated();
     }

    ue_list = undefined;           // the most current ue list - set to undefined if we know it is out of date
    ue_list_reloading = false;     // true when a reload has been requested but not completed
    last_used_ue_list = undefined; // the last ue list we actually used to generate graphics
    paused = false; 
    reading_list = false; // don't outdate the list while we read it (because reading it can trigger outdates!)
    
    queue_size = null;
    note_queue_size(x) { this.queue_size = x; }

    pause(ms) {
        this.paused = true;
        if (!ms) ms = 100;
        setTimeout( this.unpause.bind(this), ms );
    }
    unpause() { 
        this.paused = false;
        app.graph.change();
    }

    // memory reuse
    slot_pos1 = new Float32Array(2); //to reuse
    slot_pos2 = new Float32Array(2); //to reuse

    mark_link_list_outdated() {
        if (this.reading_list) return;
        if (this.ue_list) {
            this.ue_list = undefined;
            this.request_link_list_update();
            Logger.log(Logger.INFORMATION, "link_list marked outdated");
        } else {
            Logger.log(Logger.INFORMATION, "link_list was already outdated");
        }
    }

    periodically_mark_link_list_outdated() {
        this.mark_link_list_outdated();
        setTimeout(this.periodically_mark_link_list_outdated.bind(this), 1000);
    }

    // callback when the_graph_analyser finishes - store the result and note reloading is false
    reload_resolve = function (value) {
        this.ue_list = value;
        this.ue_list_reloading = false;
        if (this.ue_list.differs_from(this.last_used_ue_list)) app.graph.change();
        Logger.log(Logger.INFORMATION, "link list update completed");
        Logger.log_call(Logger.DETAIL, this.ue_list.print_all);
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

    highlight_ue_connections(node, ctx) {
        try {
            this._highlight_ue_connections(node, ctx);
        } catch (e) {
            console.error(e);
        }
    }

    _highlight_ue_connections(node, ctx) {
        this.reading_list = true;
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
        this.reading_list = false;
    }

    list_ready(make_latest) {
        if (this.paused) return false;
        if (!this.the_graph_analyser) return false; // we don't have the analyser yet (still loading)
        if (!this.ue_list) this.request_link_list_update();
        if (!this.ue_list) return false;
        if (make_latest) this.last_used_ue_list = this.ue_list;
        return true;
    }

    node_in_ueconnection(ue_connection, id) {
        return (get_group_node(ue_connection.control_node.id).id == id || get_group_node(ue_connection.sending_to.id).id == id)
    }

    any_node_in_ueconnection(ue_connection, list_of_nodes) {
        return (Object.values(list_of_nodes).find((node) => (this.node_in_ueconnection(ue_connection, node.id))))?true:false;
    }

    render_all_ue_links(ctx) {
        try {
            this._render_all_ue_links(ctx);
        } catch (e) {
            console.error(e);
        }
    }

    _render_all_ue_links(ctx) {
        if (!this.list_ready(true)) return;

        this.reading_list = true;
        ctx.save();
        const orig_hqr = app.canvas.highquality_render;
        app.canvas.highquality_render = false;

        const mode = app.ui.settings.getSettingValue('AE.showlinks', 0);
        var animate = app.ui.settings.getSettingValue('AE.animate', 3);
        if (app.ui.settings.getSettingValue('AE.stop.animation.running', true) && this.queue_size>0) animate = 0;
        if (animate==2 || animate==3) this.animate_step(ctx);

        var any_links_shown = false;
        var any_links = false;

        this.ue_list.all_ue_connections().forEach((ue_connection) => {
            any_links = true;
            var show = false;
            if (mode==4) show = true;
            if ( (mode==2 || mode==3) && app.canvas.node_over && this.node_in_ueconnection(ue_connection, app.canvas.node_over.id) ) show = true;
            if ( (mode==1 || mode==3) && this.any_node_in_ueconnection(ue_connection, app.canvas.selected_nodes)) show = true;

            if ( show ) {
                    this._render_ue_link(ue_connection, ctx, animate);
                    any_links_shown = true;
                }
        });

        
        if (animate>0) {
            /*
            If animating, we want to mark the visuals as changed so the animation updates - but not often!
            If links shown:
              - If showing dots, wait 30ms
              - Otherwise, wait 100ms
            If no links are shown
              - If there are links, and our mode is mouseover, wait 200ms
              - Otherwise don't request an update (there are no links that could be shown without something else requesting a redraw)
            */
            const timeout = (any_links_shown) ? ((animate%2 == 1) ? 30 : 100) : ((mode==2 || mode==3) && any_links) ? 200 : -1;
            if (timeout>0) setTimeout( app.graph.change.bind(app.graph), timeout );
        }

        app.canvas.highquality_render = orig_hqr;
        ctx.restore();
        this.reading_list = false;
    }


    _render_ue_link(ue_connection, ctx, animate) {
        try {
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

            var color = LGraphCanvas.link_type_colors[ue_connection.type];
            if (color=="") color = app.canvas.default_link_color;
            ctx.shadowColor = color;
            
            app.canvas.renderLink(ctx, pos1, pos2, undefined, true, animate%2, color, sta_direction, end_direction, undefined);
        } catch (e) {
            Logger.log(Logger.PROBLEM, `Couldn't render UE link ${ue_connection}. That's ok if something just got deleted.`);
        }
    }

    animate_step(ctx) {
        const max_blur = 8;
        const speed = 0.75;
        var f = (LiteGraph.getTime()*0.001*speed) % 1;
        const step = Math.ceil(f*2*max_blur) % (2*max_blur);
        ctx.shadowBlur = (step<max_blur) ? step + 4 : 3 + 2*max_blur - step;
    }
}

export {displayMessage, update_input_label, nodes_in_my_group, nodes_not_in_my_group, nodes_in_groups_matching, nodes_my_color, nodes_not_my_color, indicate_restriction}
export{ LinkRenderController}