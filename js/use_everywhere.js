import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { shared } from "./shared.js";

import { is_UEnode, inject, Logger, defineProperty, graphConverter, create } from "./use_everywhere_utilities.js";
import { indicate_restriction } from "./use_everywhere_ui.js";
import { LinkRenderController } from "./use_everywhere_ui.js";
import { GraphAnalyser } from "./use_everywhere_graph_analysis.js";
import { canvas_menu_settings, SETTINGS, add_extra_menu_items } from "./use_everywhere_settings.js";
import { add_debug } from "./ue_debug.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { convert_to_links } from "./use_everywhere_apply.js";
import { master_graph, visible_graph, copy_ue_accepting } from "./use_everywhere_subgraph_utils.js";
import { any_restrictions, setup_ue_properties_oncreate, setup_ue_properties_onload } from "./ue_properties.js";
import { edit_restrictions } from "./ue_properties_editor.js";
import { language_changed } from "./i18n.js";
import { input_changed, fix_inputs, post_configure_fixes } from "./connections.js";
import { comboclone_on_connection, is_combo_clone } from "./combo_clone.js";

/*
The ui component that looks after the link rendering
*/
var linkRenderController;
var graphAnalyser;

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
    if (object) inject(object, methodname, tracetext, linkRenderController.mark_link_list_outdated, linkRenderController);
}

class Deferred {
    constructor() { this.deferred_actions = [] }
    push(x) { this.deferred_actions.push(x) } // add action of the form: { fn:function, args:array }
    execute() {
        while (this.deferred_actions.length>0) {
            const action = this.deferred_actions.pop()
            try { action?.fn(...action?.args) } 
            catch (e) { Logger.log_error(e) }
        }
    }
}

const deferred_actions = new Deferred()

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
            if (this.IS_UE && side==1) { // side 1 is input
                input_changed(this, slot, connect, link_info)
                
                if (!shared.graph_being_configured) {
                    // do the fix at the end of graph change
                    deferred_actions.push( { fn:fix_inputs, args:[this,"deferred onConnectionsChange",]} )
                    // disconnecting doesn't trigger graphChange call?
                    setTimeout(deferred_actions.execute.bind(deferred_actions), 100)
                }
            }
            linkRenderController?.mark_link_list_outdated();
            onConnectionsChange?.apply(this, arguments);
        };

        /* Combo Clone can connect to COMBO or to UE nodes */
        if (nodeData.name=="Combo Clone") {
            const onConnectOutput = nodeType.prototype.onConnectOutput
            nodeType.prototype.onConnectOutput = function(outputIndex, type, input, inputNode, inputIndex) {
                if  (!(type=="COMBO" || is_UEnode(inputNode))) return false;
                return onConnectOutput?.apply(this,arguments)
            }
        }
        

        
        /*
        Extra menu options are the node right click menu.
        We add to this list, and also insert a link list outdate to everything.
        */
        add_extra_menu_items(nodeType.prototype, inject_outdating_into_object_method)

        if (is_UEnode(nodeType)) {
            const original_onDrawTitleBar = nodeType.prototype.onDrawTitleBar;
            nodeType.prototype.onDrawTitleBar = function(ctx, title_height) {
                original_onDrawTitleBar?.apply(this, arguments);
                if (any_restrictions(this)) indicate_restriction(ctx, title_height);
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

    async nodeCreated(node) {
        if (!node.properties.ue_properties && !is_UEnode(node) && !shared.graph_being_configured) {
            node.properties.ue_properties = { widget_ue_connectable : {}, input_ue_unconnectable : {} }
        }
        const original_afterChangeMade = node.afterChangeMade
        node.afterChangeMade = (p, v) => {
            original_afterChangeMade?.(p,v)
            if (p==='mode') {
                linkRenderController.mark_link_list_outdated();
                node.widgets?.forEach((widget) => {widget.onModeChange?.(v)}); // no idea why I have this?
            }
        }

        // removing a node makes the list dirty
        inject_outdating_into_object_method(node, 'onRemoved', `node ${node.id} removed`)

        // check if the extra menu_items have been added (catch subgraph niode creation)
        add_extra_menu_items(node, inject_outdating_into_object_method)

        // creating a node makes the link list dirty - but give the system a moment to finish
        setTimeout( ()=>{linkRenderController.mark_link_list_outdated()}, 100 );
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
            if (linkRenderController) linkRenderController.note_queue_size(detail ? detail.exec_info.queue_remaining : 0)
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
                linkRenderController.pause('drawFrontCanvas')
                const v = original_drawNode.apply(this, arguments);
                linkRenderController.highlight_ue_connections(node, ctx);
                if (node._last_seen_bg !== node.bgcolor) linkRenderController.mark_link_list_outdated();
                node._last_seen_bg = node.bgcolor
                return v
            } catch (e) {
                Logger.log_error(e)
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
                Logger.log_error(e)
            } finally {
                try {
                    linkRenderController.disable_all_connected_widgets(false)
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
                linkRenderController.render_all_ue_links(ctx);
            } catch (e) {
                Logger.log_error(e)
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

        const original_afterChange = app.graph.afterChange
        app.graph.afterChange = function () {
            deferred_actions.execute()
            original_afterChange?.apply(this, arguments)
        }

        const original_graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            if (shared.prompt_being_queued) {
                return await graphAnalyser.graph_to_prompt( );
            } else {
                return await original_graphToPrompt.apply(app, arguments);
            }
        }
        
        app.ue_modified_prompt = async function () {
            return await graphAnalyser.graph_to_prompt();
        }

        const original_queuePrompt = app.queuePrompt;
        app.queuePrompt = async function () {
            shared.prompt_being_queued = true;
            try {
                return await original_queuePrompt.apply(app, arguments);
            } finally {
                shared.prompt_being_queued = false;
            }
        }
        
        app.canvas.__node_over = app.canvas.node_over;
        defineProperty(app.canvas, 'node_over', {
            get: ( )=>{return app.canvas.__node_over },
            set: (v)=>{app.canvas.__node_over = v; linkRenderController.node_over_changed(v)}   
        } )

        app.canvas.canvas.addEventListener('litegraph:set-graph', ()=>{
            linkRenderController.mark_link_list_outdated()
            setTimeout(()=>{app.canvas.setDirty(true,true)},200)
        })

        app.canvas.canvas.addEventListener('litegraph:canvas', (e)=>{
            if (e?.detail?.subType=='node-double-click') {
                const node = e.detail.node
                if (node.IS_UE) {
                    if (app.ui.settings.getSettingValue('Comfy.Node.DoubleClickTitleToEdit') && e.detail.originalEvent.canvasY<node.pos[1]) return
                    edit_restrictions(null, null, null, null, node)
                }
            }
        })

        if (false) add_debug();


        const original_subgraph = app.graph.convertToSubgraph
        app.graph.convertToSubgraph = function () {
            const ctb_was = graphAnalyser.connect_to_bypassed
            graphAnalyser.connect_to_bypassed = true
            try {
                const cur_list = graphAnalyser.wait_to_analyse_visible_graph()
                const mods = convert_to_links(cur_list, null, visible_graph());
                const r = original_subgraph.apply(this, arguments);
                mods.restorer()
                copy_ue_accepting(r.node)
                return r
            } finally {
                graphAnalyser.connect_to_bypassed = ctb_was
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
        linkRenderController.pause("before configure", 1000)
        graphAnalyser.pause("before configure", 1000)
        shared.graph_being_configured = true
    },

    afterConfigureGraph() {
        graphConverter.remove_saved_ue_links_recursively(app.graph)
        //convert_old_nodes(app.graph)
        shared.graph_being_configured = false
        post_configure_fixes(master_graph())
    }

});
