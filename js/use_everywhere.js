import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { is_UEnode, is_helper, inject, Logger, get_real_node, defineProperty, graphConverter } from "./use_everywhere_utilities.js";
import { update_input_label, indicate_restriction } from "./use_everywhere_ui.js";
import { LinkRenderController } from "./use_everywhere_ui.js";
import { GraphAnalyser } from "./use_everywhere_graph_analysis.js";
import { node_menu_settings, canvas_menu_settings, non_ue_menu_settings, SETTINGS } from "./use_everywhere_settings.js";
import { add_debug } from "./ue_debug.js";
import { settingsCache } from "./use_everywhere_cache.js";

/*
The ui component that looks after the link rendering
*/
var linkRenderController;
var graphAnalyser;

/*
Inject a call to linkRenderController.mark_list_link_outdated into a method with name methodname on all objects in the array
If object is undefined, do nothing.
The injection is added at the end of the existing method (if the method didn't exist, it is created).
A Logger.trace call is added at the start with 'tracetext'
*/
function inject_outdating_into_objects(array, methodname, tracetext) {
    if (array) {
        array.forEach((object) => { inject_outdating_into_object_method(object, methodname, tracetext); })
    }
}
function inject_outdating_into_object_method(object, methodname, tracetext) {
    if (object) inject(object, methodname, tracetext, linkRenderController.mark_link_list_outdated, linkRenderController);
}

app.registerExtension({
	name: "cg.customnodes.use_everywhere",
    settings: SETTINGS, 

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        /*
        When a node is connected or unconnected, the link list is dirty.
        If it is a UE node, we need to update it as well
        */
        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (side,slot,connect,link_info,output) {        
            Logger.trace("onConnectionsChange", arguments, this);
            if (this.IS_UE && side==1) { // side 1 is input
                if (this.type=="Anything Everywhere?" && slot!=0) {
                    // don't do anything for the regexs
                } else {
                    const type = (connect && link_info) ? get_real_node(link_info?.origin_id)?.outputs[link_info?.origin_slot]?.type : undefined;
                    this.input_type[slot] = type;
                    if (link_info) link_info.type = type ? type : "*";
                    update_input_label(this, slot, app);
                }
            }
            linkRenderController.mark_link_list_outdated();
            onConnectionsChange?.apply(this, arguments);
        };

        /*
        Extra menu options are the node right click menu.
        We add to this list, and also insert a link list outdate to everything.
        */
        const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function(_, options) {
            Logger.trace("getExtraMenuOptions", arguments, this);
            getExtraMenuOptions?.apply(this, arguments);
            if (is_UEnode(this)) {
                node_menu_settings(options, this);
            } else {
                non_ue_menu_settings(options, this);
            }
            inject_outdating_into_objects(options,'callback',`menu option on ${this.id}`);
        }



        /*
        When a UE node is created, we set the group and color restriction properties.
        We also create pseudo-widgets for all the inputs so that they can be searched
        and to avoid other code throwing errors.
        */
        if (is_UEnode(nodeType)) {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                if (!this.properties) this.properties = {}
                this.properties.group_restricted = 0;
                this.properties.color_restricted = 0;
                if (this.inputs) {
                    if (!this.widgets) this.widgets = [];
                    for (const input of this.inputs) {
                        if (input.widget && !this.widgets.find((w) => w.name === input.widget.name)) this.widgets.push(input.widget)
                    }
                }
                return r;
            }
        }
    },

    async nodeCreated(node) {
        if (!node.__mode) {
            node.__mode = node.mode
            defineProperty(node, "mode", {
                get: ( )=>{return node.__mode},
                set: (v)=>{node.__mode = v; node.afterChangeMade?.('mode', v);}            
            })
        }
        if (!node.__bgcolor) {
            node.__bgcolor = node.bgcolor
            defineProperty(node,"bgcolor", {
                get: ( )=>{return node.__bgcolor},
                set: (v)=>{node.__bgcolor = v; node.afterChangeMade?.('bgcolor', v);}                       
            })
        }
        const acm = node.afterChangeMade
        node.afterChangeMade = (p, v) => {
            acm?.(p,v)
            //if (p==='bgcolor') {
            //    if (node._being_drawn) return; // the bgcolor gets set by the built in node draw...
            //    linkRenderController.mark_link_list_outdated();
            //}
            if (p==='mode') {
                linkRenderController.mark_link_list_outdated();
                node.widgets?.forEach((widget) => {widget.onModeChange?.(v)}); // no idea why I have this?
            }
        }

        node.IS_UE = is_UEnode(node);
        if (node.IS_UE) {
            node.input_type = [undefined, undefined, undefined]; // for dynamic input types       

            // If a widget on a UE node is edited, link list is dirty
            inject_outdating_into_objects(node.widgets,'callback',`widget callback on ${node.id}`);

            // draw the indication of group restrictions
            const original_onDrawTitleBar = node.onDrawTitleBar;
            node.onDrawTitleBar = function(ctx, title_height) {
                original_onDrawTitleBar?.apply(this, arguments);
                if (node.properties.group_restricted || node.properties.color_restricted) indicate_restriction(ctx, title_height);
            }
        }


        if (is_helper(node)) { // editing a helper node makes the list dirty
            inject_outdating_into_objects(node.widgets,'callback',`widget callback on ${this.id}`);
        }

        // removing a node makes the list dirty
        inject_outdating_into_object_method(node, 'onRemoved', `node ${node.id} removed`)

        graphConverter.on_node_created(node)

        // creating a node makes the link list dirty - but give the system a moment to finish
        setTimeout( ()=>{linkRenderController.mark_link_list_outdated()}, 100 );
    }, 

    // When a graph node is loaded convert it if needed
    loadedGraphNode(node) { 
        if (graphConverter.running_116_plus()) { graphConverter.convert_if_pre_116(node); }
    },

	async setup() {

        api.addEventListener("status", ({detail}) => {
            if (linkRenderController) linkRenderController.note_queue_size(detail ? detail.exec_info.queue_remaining : 0)
        });

        /* if we are on version 1.16 or later, stash input data to convert nodes when they are loaded */
        if (graphConverter.running_116_plus()) {
            const original_loadGraphData = app.loadGraphData;
            app.loadGraphData = function (data) {
                try {
                    graphConverter.store_node_input_map(data);
                } catch (e) { Logger.log_error(Logger.ERROR, `in loadGraphData ${e}`); }
                const cvw_was = settingsCache.getSettingValue("Comfy.Validation.Workflows")
                if (settingsCache.getSettingValue("Use Everywhere.Options.block_graph_validation")) {
                    app.ui.settings.setSettingValue("Comfy.Validation.Workflows", false);
                }
                original_loadGraphData.apply(this, arguments);
                app.ui.settings.setSettingValue("Comfy.Validation.Workflows", cvw_was);
            }
        }
        
        /* 
        When we draw a node, render the virtual connection points
        */
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            
            try {
                linkRenderController.pause('drawNode')
                const v = original_drawNode.apply(this, arguments);
                linkRenderController.highlight_ue_connections(node, ctx);
                if (node._last_seen_bg !== node.bgcolor) linkRenderController.mark_link_list_outdated();
                node._last_seen_bg = node.bgcolor
                return v
            } catch (e) {
                Logger.log_error(Logger.ERROR, e)
            } finally {          
                linkRenderController.unpause()
            }
        }

        const original_drawFrontCanvas = LGraphCanvas.prototype.drawFrontCanvas
        LGraphCanvas.prototype.drawFrontCanvas = function() {
            try {
                linkRenderController.disable_all_connected_widgets(true)
                return original_drawFrontCanvas.apply(this, arguments);
            }  catch (e) {
                Logger.log_error(Logger.ERROR, e)
            } finally {
                try {
                    linkRenderController.disable_all_connected_widgets(false)
                } catch (e) {
                    Logger.log_error(Logger.ERROR, e)
                } 
            }
        }

        /*
        When we draw connections, do the ue ones as well (logic for on/off is in lrc)
        */
        const drawConnections = LGraphCanvas.prototype.drawConnections;
        LGraphCanvas.prototype.drawConnections = function(ctx) {
            drawConnections?.apply(this, arguments);
            try {
                linkRenderController.render_all_ue_links(ctx);
            } catch (e) {
                Logger.log_error(Logger.ERROR, e)
            }
        }
        
        /* 
        Canvas menu is the right click on backdrop.
        We need to add our options, and hijack the others to mark link list dirty
        */
        const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function () {
            // Add our items to the canvas menu 
            const options = original_getCanvasMenuOptions.apply(this, arguments);
            canvas_menu_settings(options);
            
            //  every menu item makes our list dirty
            inject_outdating_into_objects(options,'callback',`menu option on canvas`);

            return options;
        }

                        /*
        Finding a widget by it's name is something done a lot of times in rendering, 
        so add a method that caches the names that can be used deep in the rendering code.

        TODO: Ought to delete this._widgetNameMap when widgets are added or removed.
        */
        LGraphNode.prototype._getWidgetByName = function(nm) {
            if (this._widgetNameMap === undefined || !this._widgetNameMap[nm]) {
                this._widgetNameMap = {}
                this.widgets?.forEach((w)=>{this._widgetNameMap[w.name] = w})
            }
            if (!this._widgetNameMap[nm]) {
                let breakpoint_be_here; // someone is asking for a widget that doesn't exist
            }
            return this._widgetNameMap[nm]
        }


	},

    init() {
        graphAnalyser = GraphAnalyser.instance();
        linkRenderController = LinkRenderController.instance(graphAnalyser);

        var prompt_being_queued = false;

        const original_graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            if (prompt_being_queued) {
                return await graphAnalyser.graph_to_prompt( graphAnalyser.analyse_graph(true, true) );
            } else {
                return await original_graphToPrompt.apply(app, arguments);
            }
        }

        const original_queuePrompt = app.queuePrompt;
        app.queuePrompt = async function () {
            prompt_being_queued = true;
            try {
                return await original_queuePrompt.apply(app, arguments);
            } finally {
                prompt_being_queued = false;
            }
        }
        
        app.canvas.__node_over = app.canvas.node_over;
        defineProperty(app.canvas, 'node_over', {
            get: ( )=>{return app.canvas.__node_over },
            set: (v)=>{app.canvas.__node_over = v; linkRenderController.node_over_changed(v)}   
        } )

        if (false) add_debug();

        const export_api_label = Array.from(document.getElementsByClassName('p-menubar-item-label')).find((e)=>e.innerText=='Export (API)')
        if (export_api_label) {
            export_api_label.addEventListener('click', (e)=>{
                //const ues = GraphAnalyser.instance().analyse_graph(true);
                const ue_links = app.graph.extra['ue_links'];
                if (ue_links.length>0) {
                    if (!confirm("This model contains links added by Use Everywhere which won't work with the API. " + 
                        "You probably want to use 'Convert all UEs to real links' on the canvas right click menu before saving.\n\n" + 
                        "Save anyway?")) 
                    {
                        e.stopImmediatePropagation()
                        e.stopPropagation()
                        e.preventDefault()
                    }
                }
            })
        }
    },

    beforeConfigureGraph() {
        linkRenderController.pause("before configure", 1000)
        graphAnalyser.pause("before configure", 1000)
        graphConverter.graph_being_configured = true
    },

    afterConfigureGraph() {
        graphConverter.remove_saved_ue_links()
        graphConverter.graph_being_configured = false
    }

});
