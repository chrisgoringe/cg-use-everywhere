import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { shared, deferred_actions } from "./shared.js";

import { is_UEnode, inject, Logger, defineProperty, graphConverter, create } from "./use_everywhere_utilities.js";
import { title_bar_additions, LinkRenderController } from "./use_everywhere_ui.js";
import { GraphAnalyser } from "./use_everywhere_graph_analysis.js";
import { canvas_menu_settings, SETTINGS, add_extra_menu_items } from "./use_everywhere_settings.js";
import { add_debug } from "./ue_debug.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { convert_to_links } from "./use_everywhere_apply.js";
import { visible_graph, fix_new_subgraph_node } from "./use_everywhere_subgraph_utils.js";
import { setup_ue_properties_oncreate, setup_ue_properties_onload } from "./ue_properties.js";
import { edit_restrictions } from "./ue_properties_editor.js";
import { language_changed } from "./i18n.js";
import { input_changed, fix_inputs } from "./connections.js";
import { comboclone_on_connection, is_combo_clone } from "./combo_clone.js";
import { ue_callbacks } from "./recursive_callbacks.js";

/*
All nodes need the onDrawTitleBar method so they can show if they are broadcasting UE data.
*/
function add_methods_to_all_nodes(node) {
    if (node.ue_methods_added) return Logger.log_problem(`Node ${node.id} already has UE methods added`);

    try {
        add_extra_menu_items(node, inject_outdating_into_object_method) // right click menu additions
        
        const original_onDrawTitleBar = node.onDrawTitleBar;
        node.onDrawTitleBar = function(ctx, title_height) {
            if (original_onDrawTitleBar) original_onDrawTitleBar.apply(this, arguments);
            title_bar_additions(node, ctx, title_height)
        }
        node.ue_methods_added = true;
    } catch (e) {
        Logger.log_error(e);
    }
    
}

/*
Inject a call to linkRenderController.mark_list_link_outdated into a method with name methodname on all objects in the array
If object is undefined, do nothing.
The injection is added at the end of the existing method (if the method didn't exist, it is created).
*/
function inject_outdating_into_objects(array, methodname, tracetext) {
    if (array) {
        array.forEach((object) => { inject_outdating_into_object_method(object, methodname, tracetext); })
    }
}
function inject_outdating_into_object_method(object, methodname, tracetext) {
    if (object) inject(object, methodname, tracetext, shared.linkRenderController.mark_link_list_outdated, shared.linkRenderController);
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
            if (is_combo_clone(this) && !shared.prompt_being_queued) comboclone_on_connection(this, link_info, connect)
            if (is_UEnode(this, false) && side==1) { // side 1 is input
                input_changed(this, slot, connect, link_info)
                
                if (!shared.graph_being_configured) {
                    // do the fix at the end of graph change
                    deferred_actions.push( { fn:fix_inputs, args:[this,"deferred onConnectionsChange",]} )
                }
            }
            shared.linkRenderController?.mark_link_list_outdated();
            onConnectionsChange?.apply(this, arguments);
        };

        /* Combo Clone can connect to COMBO or to UE nodes */
        if (nodeData.name=="Combo Clone") {
            const onConnectOutput = nodeType.prototype.onConnectOutput
            nodeType.prototype.onConnectOutput = function(outputIndex, type, input, inputNode, inputIndex) {
                if  (!(type=="COMBO" || is_UEnode(inputNode, false))) return false;
                return onConnectOutput?.apply(this,arguments)
            }
        }

        if (is_UEnode(nodeType)) {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                Logger.log_detail(`Node ${this.id} created`)
                setup_ue_properties_oncreate(this)
                return r;
            }
        }
    },

    async nodeCreated(node) { // the node isn't part of the graph yet, so can't do anything involving id or links.
        add_methods_to_all_nodes(node)

        if (!node.properties.ue_properties && !is_UEnode(node, false) && !shared.graph_being_configured) {
            node.properties.ue_properties = { widget_ue_connectable : {}, input_ue_unconnectable : {} }
        }

    }, 

    // When a graph node is loaded convert it if needed
    loadedGraphNode(node) { 
        if (graphConverter.running_116_plus()) { 
            graphConverter.convert_if_pre_116(node);
            if (node.isSubgraphNode?.()) {
                node.subgraph.nodes.forEach((n) => {
                    graphConverter.convert_if_pre_116(n);
                })
            }
        }
        setup_ue_properties_onload(node)
    },

	async setup() {

        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href': new URL("./ue.css", import.meta.url).href } )

        api.addEventListener("status", ({detail}) => {
            if (shared.linkRenderController) shared.linkRenderController.note_queue_size(detail ? detail.exec_info.queue_remaining : 0)
        });

        /* if we are on version 1.16 or later, stash input data to convert nodes when they are loaded */
        if (graphConverter.running_116_plus()) {
            const original_loadGraphData = app.loadGraphData;
            app.loadGraphData = async function (data) {
                try {
                    graphConverter.store_node_input_map(data);
                } catch (e) { Logger.log_error(e); }
                const cvw_was = settingsCache.getSettingValue("Comfy.Validation.Workflows")
                if (settingsCache.getSettingValue("Use Everywhere.Options.block_graph_validation")) {
                    app.ui.settings.setSettingValue("Comfy.Validation.Workflows", false);
                }
                await original_loadGraphData.apply(this, arguments);
                app.ui.settings.setSettingValue("Comfy.Validation.Workflows", cvw_was);
                //return v;
            }
        }
        
        /* 
        When we draw a node, render the virtual connection points
        */
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            try {
                shared.linkRenderController.pause('drawFrontCanvas')
                const v = original_drawNode.apply(this, arguments);
                shared.linkRenderController.highlight_ue_connections(node, ctx);
                if (node._last_seen_bg !== node.bgcolor) shared.linkRenderController.mark_link_list_outdated();
                node._last_seen_bg = node.bgcolor
                return v
            } catch (e) {
                Logger.log_error(e)
            } finally {          
                shared.linkRenderController.unpause()
            }
        }

        /*
        Before drawing the canvas, temporarily disable all the ue connected widgets  
        so they get rendered as greyed out.
        */
        const original_drawFrontCanvas = LGraphCanvas.prototype.drawFrontCanvas
        LGraphCanvas.prototype.drawFrontCanvas = function() {
            try {
                shared.linkRenderController.disable_all_connected_widgets(true)
                return original_drawFrontCanvas.apply(this, arguments);
            }  catch (e) {
                Logger.log_error(e)
            } finally {
                try {
                    shared.linkRenderController.disable_all_connected_widgets(false)
                } catch (e) {
                    Logger.log_error(e)
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
                shared.linkRenderController.render_all_ue_links(ctx);
            } catch (e) {
                Logger.log_error(e)
            }
        }
        
        /* 
        Canvas menu is the right click on backdrop.  Add our settings there.
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
        TODO: Or better maybe to retire this.
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
        shared.graphAnalyser        = new GraphAnalyser();
        shared.linkRenderController = new LinkRenderController();

        const original_beforeChange = app.graph.beforeChange
        app.graph.beforeChange = function () {
            shared.in_midst_of_change = true
            original_beforeChange?.apply(this, arguments)
        }

        const original_afterChange = app.graph.afterChange
        app.graph.afterChange = function () {
            original_afterChange?.apply(this, arguments)
            shared.in_midst_of_change = false
        }

        const original_graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            if (shared.prompt_being_queued) {
                return await shared.graphAnalyser.graph_to_prompt( );
            } else {
                Logger.log_problem("graphToPrompt called when !prompt_being_queued - why?")
                if (app.ui.settings.getSettingValue("Use Everywhere.Options.always_modify_graph")) {
                    Logger.log_info("always_modify_graph is set, so doing so anyway")
                    return await shared.graphAnalyser.graph_to_prompt( );
                }
                return await original_graphToPrompt.apply(app, arguments);
            }
        }
        
        app.ue_modified_prompt = async function () { // API function
            return await shared.graphAnalyser.graph_to_prompt();
        }

        const original_queuePrompt = app.queuePrompt;
        app.queuePrompt = async function () {
            try {
                shared.prompt_being_queued = true;
                return await original_queuePrompt.apply(app, arguments);
            } finally {
                shared.prompt_being_queued = false;
            }
        }
        
        app.canvas.__node_over = app.canvas.node_over;
        defineProperty(app.canvas, 'node_over', {
            get: ( )=>{return app.canvas.__node_over },
            set: (v)=>{app.canvas.__node_over = v; shared.linkRenderController.node_over_changed(v)}   
        } )

        app.canvas.canvas.addEventListener('litegraph:set-graph', ()=>{
            shared.linkRenderController.mark_link_list_outdated()
            setTimeout(()=>{app.canvas.setDirty(true,true)},200)
        })

        app.canvas.canvas.addEventListener('litegraph:canvas', (e)=>{
            if (e?.detail?.subType=='node-double-click') {
                const node = e.detail.node
                if (is_UEnode(node, true)) {
                    if (app.ui.settings.getSettingValue('Comfy.Node.DoubleClickTitleToEdit') && e.detail.originalEvent.canvasY<node.pos[1]) return
                    edit_restrictions(null, null, null, null, node)
                }
            }
        })

        if (false) add_debug();


        const original_subgraph = app.graph.convertToSubgraph
        app.graph.convertToSubgraph = function () {
            const ctb_was = shared.graphAnalyser.connect_to_bypassed
            shared.graphAnalyser.connect_to_bypassed = true
            try {
                const cur_list = shared.graphAnalyser.analyse_graph(visible_graph())
                if (!cur_list) Logger.log_problem('convert to subgraph failed to get ues')
                const mods = convert_to_links(cur_list, null, visible_graph());
                const r = original_subgraph.apply(this, arguments);
                mods.restorer()
                fix_new_subgraph_node(r.node)
                return r
            } finally {
                shared.graphAnalyser.connect_to_bypassed = ctb_was
            }
        }

        /* catch changes in language (and read initial value) */
        const locale_onChange = app.ui.settings.settingsLookup['Comfy.Locale'].onChange
        app.ui.settings.settingsLookup['Comfy.Locale'].onChange = function(is_now, was_before) {
            language_changed(is_now, was_before)
            return locale_onChange?.apply(this, arguments)
        }
        language_changed(app.ui.settings.getSettingValue('Comfy.Locale'), null)
    },

    beforeConfigureGraph() {
        shared.linkRenderController.pause("before configure", 1000)
        shared.graphAnalyser.pause("before configure", 1000)
        shared.graph_being_configured = true
    },

    afterConfigureGraph() {
        shared.graph_being_configured = false
        ue_callbacks.dispatch('afterConfigureGraph')
    }

});