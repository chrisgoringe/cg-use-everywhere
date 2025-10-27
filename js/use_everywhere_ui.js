import { Logger, get_real_node, Pausable, node_can_broadcast } from "./use_everywhere_utilities.js";
import { app } from "../../scripts/app.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { in_visible_graph, visible_graph } from "./use_everywhere_subgraph_utils.js";
import { maybe_show_tooltip } from "./tooltip_window.js";
import { is_able_to_broadcast, is_connectable } from "./use_everywhere_settings.js";
import { shared } from "./shared.js";
import { any_restrictions } from "./ue_properties.js";

export function nodes_in_my_group(node) {
    const nodes_in = new Set();
    node.graph._groups.forEach((group) => {
        if (!app.canvas.selected_group_moving) group.recomputeInsideNodes();
        if (group._nodes?.find((nd) => { return (nd.id===node.id) } )) {
            group._nodes.forEach((nd) => { nodes_in.add(nd.id) } )
        }
    });
    return [...nodes_in];
}

export function nodes_not_in_my_group(node) {
    const nid = nodes_in_my_group(node);
    const nodes_not_in = [];
    node.graph._nodes.forEach((nd) => {
        if (!nid.includes(nd.id)) nodes_not_in.push(nd.id);
    });
    return nodes_not_in;
}

export function nodes_in_groups_matching(regex, already_limited_to) {
    const nodes_in = new Set();
    app.graph._groups.forEach((group) => {
        if (regex.regex.test(group.title) != regex.invert) {
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


export function nodes_my_color(node, already_limited_to) {
    const nodes_in = new Set();
    const color = get_real_node(node.id)?.color
    if (already_limited_to) {
        already_limited_to.forEach((nid) => {
            if (get_real_node(nid, node.graph)?.color==color) nodes_in.add(nid)
        })
    } else {
        node.graph._nodes.forEach((nd) => {
            if (nd.color==color) nodes_in.add(nd.id)
        })
    }
    return [...nodes_in];
}

export function nodes_not_my_color(node, already_limited_to) {
    const nodes_in = new Set();
    const color = get_real_node(node.id)?.color;
    if (already_limited_to) {
        already_limited_to.forEach((nid) => {
            if (get_real_node(nid, node.graph)?.color!=color) nodes_in.add(nid)
        })
    } else {
        node.graph._nodes.forEach((nd) => {
            if (nd.color!=color) nodes_in.add(nd.id)
        })
    }
    return [...nodes_in];
}

export function title_bar_additions(node, ctx, title_height) {
    if (node_can_broadcast(node)) {
        const restricted = any_restrictions(node);
        const sending    = shared.linkRenderController.node_sending_anywhere(node);

        const color = restricted ? ( sending ? "rgba(255, 72, 72, 1)" : "rgba(255, 72, 72, 0.35)" ) :
                                   ( sending ? "rgba(72, 255, 72, 1)" : "rgba(72, 255, 72, 0.35)" );

        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.roundRect(5,5-title_height,20,20,8);
        ctx.stroke();
        ctx.restore();
    }
}

export class LinkRenderController extends Pausable {

    constructor() {
        super('LinkRenderController')
        this.ue_list            = undefined; // the most current ue list - set to undefined if we know it is out of date
        this.last_used_ue_list  = undefined; // the last ue list we actually used to generate graphics
        this.link_list_outdated = false;
        this.widgets_disabled   = []
        setInterval(this.try_to_update_link_list.bind(this), 100);
        setInterval(this.mark_link_list_outdated.bind(this), 2000);
     }
    
    queue_size = null;
    note_queue_size(x) { this.queue_size = x; }
    

    //on_unpause() {app.graph.change();}

    node_over_changed(v) {
        const mode = settingsCache.getSettingValue('Use Everywhere.Graphics.showlinks');
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
            this.pause('try_to_update_link_list')
            this.ue_list = undefined;
            if (this._request_link_list_update()) this.link_list_outdated = false;
        } finally {
            this.unpause()
        }
    }

    _request_link_list_update() {
        try {
            const ues = shared.graphAnalyser.analyse_graph(visible_graph())
            if (ues==null) return false // graph analyser was paused
            this.ue_list = ues;
            if (this.ue_list.differs_from(this.last_used_ue_list)) app.graph.change();
            return true
        } catch (e) {
            Logger.log_error(e);
            return false
        } 
    }

    disable_all_connected_widgets( disable ) {
        const graph = app.canvas.graph
        if (disable) {
            graph.extra['ue_links']?.forEach((uel) => {
                const node = graph._nodes_by_id[uel.downstream]
                if (node) {
                    try {
                        const name = node.inputs[uel.downstream_slot]?.name;
                        if (name) {
                            const widget = node._getWidgetByName(name) 
                            if (widget) {
                                if (!widget.disabled) {
                                    this.widgets_disabled.push(widget)
                                    widget.disabled = true;
                                }
                                widget.linkedWidgets?.filter((w)=>!w.disabled).forEach((w)=>{
                                    this.widgets_disabled.push(w)
                                    w.disabled = true;
                                })
                            } else {
                                // it's an input not a widget, so ignore
                            }
                        } else {
                            Logger.log_problem(`In disable_all_connected_widgets, for downstream node ${node.id}, slot ${uel.downstream_slot} did not return a name`)
                        }
                    } catch(e) {
                        Logger.log_error(e);
                    }
                } else {
                    if (uel.downstream >= 0) Logger.log_problem(`In disable_all_connected_widgets, couldn't find downstream node ${uel.downstream}`)
                }
            })   
        } else {
            this.widgets_disabled.forEach((w)=>w.disabled=false)
            this.widgets_disabled = []
        }     
    }

    highlight_ue_connections(node, ctx) {        
        if (!settingsCache.getSettingValue('Use Everywhere.Graphics.highlight')) return;
        if (!node.inputs) return;
        
        try {
            this.pause('highlight_ue_connections')
            if (!this._list_ready()) return;

            // get all the inputs that can be connected and aren't
            // connected with a 'real' link
            const unconnected_connectable_names = new Set(node.inputs
                .filter((input)=>is_connectable(node,input.name))
                .filter((input)=>(!input.link))
                .map((input)=>input.name) || [])
        
            if (this.ue_list.all_connected_inputs) {
                this.ue_list.all_connected_inputs(node).forEach((ue_connection) => {
                    if (!ue_connection.control_node) return; 
                    if (!node.inputs[ue_connection.input_index]) return
 
                    const name_sent_to = node.inputs[ue_connection.input_index].name;
                    unconnected_connectable_names.delete(name_sent_to); // remove the name from the list of connectables
                    const pos2 = this._relative_connection_pos(node, true, ue_connection.input_index);

                    circle(ctx, pos2, {...CONNECTED_1, strokeStyle:LGraphCanvas.link_type_colors[ue_connection.type]})
                    circle(ctx, pos2, {...CONNECTED_2})
                });
            }
            
            unconnected_connectable_names.forEach((name) => {
                const index = node.inputs.findIndex((i) => i.name == name);
                const pos2 = this._relative_connection_pos(node, true, index);
                circle(ctx, pos2, {...UNCONNECTED_CONNECTABLE})
            })

            if (node.properties.ue_convert) {
                const sending_slots = this.ue_list.all_sending_slots(node)

                node.outputs.forEach((output,i) => {
                    if (is_able_to_broadcast(node, output.name)) {
                        const pos2 = this._relative_connection_pos(node, false, i);
                        if (sending_slots.has(i)) {
                            circle(ctx, pos2, {...CONNECTED_1, strokeStyle:LGraphCanvas.link_type_colors[node.outputs[i].type]})
                            circle(ctx, pos2, {...CONNECTED_2})
                        } else {
                            circle(ctx, pos2, {...UNCONNECTED_CONNECTABLE})
                        }
             
                    }
                })
            }
        } catch (e) {
            Logger.log_error(e);
        } finally {
            this.unpause()
        }
    }

    _relative_connection_pos(node, input, slot) {
        var pos2 = node.getConnectionPos(input, slot, this.slot_pos1);
        pos2[0] -= node.pos[0];
        pos2[1] -= node.pos[1];
        return pos2
    }

    _list_ready() {
        if (!shared.graphAnalyser) return false; // we don't have the analyser yet (still loading)
        if (!this.ue_list) {
            this.mark_link_list_outdated();
            return false;
        }
        return true;
    }

    node_sending_anywhere(node) {
        if (!this._list_ready()) return false;
        return this.ue_list.node_sending_anywhere(node);
    }

    node_in_ueconnection(ue_connection, id) {
        if (ue_connection.control_node?.id == id) return true
        if (ue_connection.sending_to?.id   == id) return true
    }

    any_node_in_ueconnection(ue_connection, list_of_nodes) {
        return (Object.values(list_of_nodes).find((node) => (this.node_in_ueconnection(ue_connection, node.id))))?true:false;
    }

    render_all_ue_links(ctx) {
        maybe_show_tooltip()
        if (this.paused()) return;
        try {
            this.pause('render_all_ue_links')
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

        const mode = settingsCache.getSettingValue('Use Everywhere.Graphics.showlinks');
        var animate = settingsCache.getSettingValue('Use Everywhere.Graphics.animate');
        if (settingsCache.getSettingValue('Use Everywhere.Graphics.stop_animation_when_running') && this.queue_size>0) animate = 0;
        if (animate==2 || animate==3) this.animate_step(ctx);

        var any_links_shown = false;
        var any_links = false;

        this.ue_list.all_ue_connections().forEach((ue_connection) => {
            any_links = true;
            var show = false;
            if ( mode==4 ) show = true;
            if ( (mode==2 || mode==3) && app.canvas.node_over && this.node_in_ueconnection(ue_connection, app.canvas.node_over.id) ) show = true;
            if ( (mode==1 || mode==3) && this.any_node_in_ueconnection(ue_connection, app.canvas.selected_nodes)) show = true;

            show = show && in_visible_graph(ue_connection.control_node) && in_visible_graph(ue_connection.sending_to);
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
            const graph = ue_connection.graph
            const node = get_real_node(ue_connection.sending_to.id, graph);

            /* this is the end node; get the position of the input */
            var pos2 = node.getConnectionPos(true, ue_connection.input_index, this.slot_pos1);

            const control_node = graph._nodes_by_id[ue_connection.control_node.id]
            if (!control_node) {
                Logger.problem(`Couldn't find position for UE link ${ue_connection}.`,null,true)
                return;
            }


            /* 
                get the position of the *input* that is being echoed except for:
                - the Seed Anywhere node: the class records control_node_input_index as -ve (-1 => 0, -2 => 1...)
                - subgraph converts
                those link to outputs
            */
            const input_source = (ue_connection.control_node_input_index >= 0 && !control_node.properties.ue_convert); 
            const source_index = (ue_connection.control_node_input_index >= 0 ) ? ue_connection.control_node_input_index : -1-ue_connection.control_node_input_index;
            const pos1 = control_node.getConnectionPos(input_source, source_index, this.slot_pos2);    


            /* get the direction that we start and end */
            const delta_x = pos2[0] - pos1[0];
            const delta_y = pos2[1] - pos1[1];
            const end_direction = LiteGraph.LEFT; // always end going into an input
            const sta_direction = ((Math.abs(delta_y) > Math.abs(delta_x)) && input_source) ? 
                                        ((delta_y>0) ? LiteGraph.DOWN : LiteGraph.UP) : 
                                        ((input_source && delta_x<0) ? LiteGraph.LEFT : LiteGraph.RIGHT)

            var color = LGraphCanvas.link_type_colors[ue_connection.type];
            if (color=="") color = app.canvas.default_link_color;

            ctx.save() 
            const rcb = app.canvas.render_connections_border;
            try {
                var skip_border = false
                if (settingsCache.getSettingValue( "Use Everywhere.Graphics.fuzzlinks" )) {
                    app.canvas.render_connections_border = false
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;      
                    skip_border = true         
                }
                app.canvas.renderLink(ctx, pos1, pos2, undefined, skip_border, animate%2, modify(color), sta_direction, end_direction, undefined);
            } catch(e) { 
                Logger.log_problem(`Issue with UE link ${ue_connection}.`);
            } finally { 
                ctx.restore() 
                app.canvas.render_connections_border = rcb;
            }

        } catch (e) {
            Logger.log_error(e, `Couldn't render UE link ${ue_connection}. That's ok if something just got deleted.`);
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

const UNCONNECTED_CONNECTABLE = {
    radius        : 3,
    strokeStyle   : "black",
    shadowColor   : "green", 
    shadowBlur    : 10,
    shadowOffsetX : 0,
    shadowOffsetY : 0,
}

const CONNECTED_1 = {
    radius:5,
    first_last:"first",
    lineWidth:1, 
    shadowColor : "white",
    shadowBlur : 10,
    shadowOffsetX : 0,
    shadowOffsetY : 0,                        
}

const CONNECTED_2 = {
    radius:4,
    first_last:"last",
    shadowBlur : 0,
    strokeStyle : "black",
}

function circle(ctx, position, properties) {
    const p = {...properties}

    const radius     = p.radius
    const first_last = p.first_last
    delete p.radius
    delete p.first_last

    if (!first_last || first_last=='first') ctx.save()
    Object.assign(ctx, p)
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(position[0]-radius,position[1]-radius,2*radius,2*radius,radius);
    ctx.stroke();
    if (!first_last || first_last=='last') ctx.restore()
}

function modify(c) {
    if (c.length==4) return c + "6"
    if (c.length==7) return c + "66"
    return c
}
