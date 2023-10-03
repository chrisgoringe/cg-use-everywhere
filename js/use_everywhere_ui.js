import { DEBUG_LEVEL } from "./use_everywhere_utilities.js";

function maybe_remove_text_display(node) {
    if (!app.ui.settings.getSettingValue('AE.details', false)) {
        const w = node.widgets?.findIndex((w) => w.name === "display_text_widget"); // created by cg_custom_nodes
        if (w>=0) {
            node.widgets.splice(w,1);   // remove it
            node.widgets[w]?.onRemove(); // cleanly
        }
        node.size = node.computeSize(); // shrink the node
        node.setDirtyCanvas(true, true);// mark for redrawing
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
            if (DEBUG_LEVEL>0) console.log("link_list_outdated");
        } else {
            if (DEBUG_LEVEL>0) console.log("link_list was already outdated");
        }
    }

    // callback when the_graph_analyser finishes - store the result and note reloading is false
    reload_resolve = function (value) {
        this.ue_list_reloading=false;
        this.ue_list = value;
        if (DEBUG_LEVEL>0) console.log("reload_resolve");
        if (DEBUG_LEVEL>1) ue_list.print_all();
        if (this._ue_links_visible) app.graph.setDirtyCanvas(true,true);
    }.bind(this)

    // callback for when the_graph_analyser fails - note reloading is false and log
    reload_reject = function() {
        this.ue_list_reloading=false;
        if (DEBUG_LEVEL>0) console.log("reload_reject");
    }.bind(this)

    // request an update to the ue_list. 
    request_link_list_update() {
        if (this.ue_list_reloading) return;                            // already doing it
        this.ue_list_reloading = true;                                 // stop any more requests
        this.the_graph_analyser().then(this.reload_resolve, this.reload_reject); // an async call is a promise; pass it two callbacks
        if (DEBUG_LEVEL>0) console.log("reload_request");
    } 

    async toggle_ue_links_visible() {
        this._ue_links_visible = !this._ue_links_visible;
        if (DEBUG_LEVEL) console.log("toggle ue links visible ${this._ue_links_visible}");
        app.graph.setDirtyCanvas(true,true);
    }

    render_ue_links(node, ctx) {
        if (!this._ue_links_visible) return;    // switched off
        if (this.ue_list===undefined) {
            this.request_link_list_update();    // list is out of date - ask for a new one
        }
        if (this.ue_list_reloading) return;     // if we don't have one, return. This method gets called frequently!

        this.ue_list.all_connected_inputs(node).forEach((ue_connection) => {
            /* we're on the end node; get the position of the input */
            var pos2 = node.getConnectionPos(true, ue_connection.input_index, this.slot_pos1);

            /* get the position of the *input* that is being echoed - except for the Seed Anywhere node, 
            which is displayed with an output: the class records source_node_input_index as -ve (-1 => 0, -2 => 1...) */
            const input_source = (ue_connection.source_node_input_index >= 0); 
            const source_index = input_source ? ue_connection.source_node_input_index : -1-ue_connection.source_node_input_index;
            const pos1 = ue_connection.source_node.getConnectionPos(input_source, source_index, this.slot_pos2);    
            
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
            app.canvas.renderLink(ctx, pos1, pos2, undefined, true, 1, color, sta_direction, end_direction, undefined);
            ctx.restore();
        })
    }
}

export {maybe_remove_text_display, LinkRenderController}