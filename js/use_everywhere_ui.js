import { Logger, get_real_node, get_group_node, Pausable, run_label_maker } from "./use_everywhere_utilities.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";
import { settingsCache } from "./use_everywhere_cache.js";

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
    if (settingsCache.getSettingValue('AE.details') || w) {
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
        node.inputs[slot].label = node.input_type[slot];
        node.inputs[slot].color_on = app.canvas.default_connection_color_byType[node.input_type[slot]];
    } else {
        node.inputs[slot].label = "anything";
        node.inputs[slot].color_on = undefined;
    }
}

class LinkRenderController extends Pausable {
    static _instance;
    static instance(tga) {
        if (!this._instance) this._instance = new LinkRenderController();
        if (tga && !this._instance.the_graph_analyser) this._instance.the_graph_analyser = tga;
        return this._instance
    }
    constructor() {
        super('LinkRenderController')
        this.the_graph_analyser = null;
        this.ue_list            = undefined; // the most current ue list - set to undefined if we know it is out of date
        this.last_used_ue_list  = undefined; // the last ue list we actually used to generate graphics
        this.link_list_outdated = false;
        setInterval(this.try_to_update_link_list.bind(this), 100);
        setInterval(this.mark_link_list_outdated.bind(this), 2000);
     }
    
    queue_size = null;
    note_queue_size(x) { this.queue_size = x; }
    

    //on_unpause() {app.graph.change();}

    node_over_changed(v) {
        const mode = settingsCache.getSettingValue('AE.showlinks');
        if (mode==2 || mode==3) app.canvas.setDirty(true,true)
    }
    
    // memory reuse
    slot_pos1 = new Float32Array(2); //to reuse
    slot_pos2 = new Float32Array(2); //to reuse


    /* 
    Outdating.

    Convention is that methods starting _ should only be called inside a pause()/unpause()
    */

    mark_link_list_outdated() {
        this.link_list_outdated = true
    }

    try_to_update_link_list() {
        if (!this.link_list_outdated) return;
        if (this.paused()) return;
        try {
            this.pause()
            this.ue_list = undefined;
            if (this._request_link_list_update()) this.link_list_outdated = false;
        } finally {
            this.unpause()
        }
    }

    _request_link_list_update() {
        try {
            const ues = this.the_graph_analyser.analyse_graph(false)
            if (ues==null) return false // graph analyser was paused
            this.ue_list = ues;
            if (this.ue_list.differs_from(this.last_used_ue_list)) app.graph.change();
            return true
        } catch (e) {
            Logger.log_error(Logger.ERROR, `request_link_list_update ${e}`);
            return false
        } 
    }

    disable_all_connected_widgets( disable ) {
        app.graph.extra['ue_links']?.forEach((uel) => {
            const node = app.graph._nodes_by_id[uel.downstream]
            if (node) {
                const name = node.inputs[uel.downstream_slot].name;
                const widget = node._getWidgetByName(name) 
                if (widget) {
                    if (disable) {
                        widget._true_disabled = widget.disabled;
                        widget.disabled = true;
                    } else {
                        if (widget._true_disabled) { widget.disabled = widget._true_disabled; }
                    }
                    widget.linkedWidgets.forEach((w)=>{
                        if (disable) {
                            w._true_disabled = w.disabled;
                            w.disabled = true;
                        } else {
                            if (w._true_disabled) { w.disabled = w._true_disabled; }
                        }                        
                    })
                }
            } else {
                Logger.log(Logger.INFORMATION,`Couldn't find node ${uel.downstream}`)
            }
        })            
    }

    highlight_ue_connections(node, ctx) {
        run_label_maker()
        if (!settingsCache.getSettingValue('AE.highlight')) return;
        
        try {
            this.pause()
            if (!this._list_ready()) return;
            const unconnected_connectables = node.properties?.widget_ue_connectable ? new Set(Object.keys(node.properties.widget_ue_connectable).filter((name) => (node.properties.widget_ue_connectable[name]))) : new Set()
            node.inputs.filter((input)=>(input.link)).forEach((input) => { unconnected_connectables.delete(input.name) });

            if (this.ue_list.all_connected_inputs) {
                this.ue_list.all_connected_inputs(node).forEach((ue_connection) => {
                    if (!ue_connection.control_node) { // control node deleted...
                        this.mark_link_list_outdated();
                        return; 
                    }
                    const name_sent_to = node.inputs[ue_connection.input_index].name;
                    unconnected_connectables.delete(name_sent_to); // remove the name from the list of connectables
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
                    ctx.shadowBlur = 0;
                    ctx.beginPath();
                    ctx.strokeStyle = "black";
                    ctx.shadowBlur = 0;
                    radius = radius - 1;
                    ctx.roundRect(pos2[0]-radius,pos2[1]-radius,2*radius,2*radius,radius);
                    ctx.stroke();

                    ctx.restore();
                });
            }
            
            unconnected_connectables.forEach((name) => {
                const index = node.inputs.findIndex((i) => i.name == name);
                var pos2 = node.getConnectionPos(true, index, this.slot_pos1);
                pos2[0] -= node.pos[0];
                pos2[1] -= node.pos[1];
                ctx.save();
                ctx.strokeStyle = "black"; 
                ctx.shadowColor = "green"; 
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                var radius = 3;
                ctx.beginPath();
                ctx.roundRect(pos2[0]-radius,pos2[1]-radius,2*radius,2*radius,radius);
                ctx.stroke();
                ctx.restore();
            })
        } catch (e) {
            Logger.log_error(Logger.ERROR, e);
        } finally {
            this.unpause()
        }
    }

    _list_ready() {
        if (!this.the_graph_analyser) return false; // we don't have the analyser yet (still loading)
        if (!this.ue_list) {
            this.mark_link_list_outdated();
            return false;
        }
        return true;
    }

    node_in_ueconnection(ue_connection, id) {
        if (ue_connection.control_node && get_group_node(ue_connection.control_node.id)?.id == id) return true
        if (ue_connection.sending_to   && get_group_node(ue_connection.sending_to.id)?.id   == id) return true
    }

    any_node_in_ueconnection(ue_connection, list_of_nodes) {
        return (Object.values(list_of_nodes).find((node) => (this.node_in_ueconnection(ue_connection, node.id))))?true:false;
    }

    render_all_ue_links(ctx) {
        if (this.paused()) return;
        try {
            this.pause()
            this._render_all_ue_links(ctx);
        } catch (e) {
            console.error(e);
        } finally {
            this.unpause()
        }
    }

    _render_all_ue_links(ctx) {
        if (!this._list_ready()) return;
        this.last_used_ue_list = this.ue_list;

        ctx.save();
        const orig_hqr = app.canvas.highquality_render;
        app.canvas.highquality_render = false;

        const mode = settingsCache.getSettingValue('AE.showlinks');
        var animate = settingsCache.getSettingValue('AE.animate');
        if (settingsCache.getSettingValue('AE.stop_animation_when_running') && this.queue_size>0) animate = 0;
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
