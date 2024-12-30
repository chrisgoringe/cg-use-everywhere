import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { is_UEnode, is_helper, inject, Logger, get_real_node, defineProperty } from "./use_everywhere_utilities.js";
import { displayMessage, update_input_label, indicate_restriction, UpdateBlocker } from "./use_everywhere_ui.js";
import { LinkRenderController } from "./use_everywhere_ui.js";
import { autoCreateMenu } from "./use_everywhere_autocreate.js";
import { add_autoprompts } from "./use_everywhere_autoprompt.js";
import { GraphAnalyser } from "./use_everywhere_graph_analysis.js";
import { main_menu_settings, node_menu_settings, canvas_menu_settings, non_ue_menu_settings } from "./use_everywhere_settings.js";
import { add_debug } from "./ue_debug.js";

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
            if (p==='bgcolor') {
                if (node.mode!=4) linkRenderController.mark_link_list_outdated();
            }
            if (p==='mode') {
                linkRenderController.mark_link_list_outdated();
                node.widgets?.forEach((widget) => {widget.onModeChange?.(v)});
            }
        }

        node.IS_UE = is_UEnode(node);
        if (node.IS_UE) {
            node.input_type = [undefined, undefined, undefined]; // for dynamic input types
            node.displayMessage = displayMessage;                // receive messages from the python code           

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

        // creating a node makes the link list dirty - but give the system a moment to finish
        setTimeout( ()=>{linkRenderController.mark_link_list_outdated()}, 100 );
    }, 

    // When a graph node is loaded collapsed the UI need to know
    // probably not needed now autocomplete is gone?
    loadedGraphNode(node) { if (node.flags.collapsed && node.loaded_when_collapsed) node.loaded_when_collapsed(); },

	async setup() {
        /*
        Add css for the autocomplete. Probably not needed now
        */
        const head = document.getElementsByTagName('HEAD')[0];
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'extensions/cg-use-everywhere/ue.css';
        head.appendChild(link);

        /*
        Listen for message-handler event from python code
        */
        function messageHandler(event) {
            const id = event.detail.id;
            const message = event.detail.message;
            const node = get_real_node(id);
            if (node && node.displayMessage) node.displayMessage(id, message);
            else (console.log(`node ${id} couldn't handle a message`));
        }
        api.addEventListener("ue-message-handler", messageHandler);

        api.addEventListener("status", ({detail}) => {
            if (linkRenderController) linkRenderController.note_queue_size(detail ? detail.exec_info.queue_remaining : 0)
        });

        /*
        Don't modify the graph when saving the workflow or api
        */
        const _original_save_onclick = document.getElementById('comfy-save-button').onclick;
        document.getElementById('comfy-save-button').onclick = function() {
            graphAnalyser.pause();
            _original_save_onclick();
            graphAnalyser.unpause()
        }
        const _original_save_api_onclick = document.getElementById('comfy-dev-save-api-button').onclick;
        document.getElementById('comfy-dev-save-api-button').onclick = function() {
            graphAnalyser.pause();
            // should check for UE links here and give a warning: #217
            _original_save_api_onclick();
            graphAnalyser.unpause();
        }
        
        /* 
        When we draw a node, render the virtual connection points
        */
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            UpdateBlocker.push()
            try {
                const v = original_drawNode.apply(this, arguments);
                linkRenderController.highlight_ue_connections(node, ctx);
                return v
            } finally { UpdateBlocker.pop() }
        }

        /*
        When we draw connections, do the ue ones as well (logic for on/off is in lrc)
        */
        const drawConnections = LGraphCanvas.prototype.drawConnections;
        LGraphCanvas.prototype.drawConnections = function(ctx) {
            drawConnections?.apply(this, arguments);
            linkRenderController.render_all_ue_links(ctx);
        }

        /*
        Add to the main settings
        */
        main_menu_settings();
        
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
        When you drag from a node, showConnectionMenu is called. If shift key is pressed call ours
        Broken #219
        */
        const showSearchBox = LGraphCanvas.prototype.showSearchBox;
        LGraphCanvas.prototype.showSearchBox = function (optPass) {
            if (optPass.shiftKey) {
                autoCreateMenu.apply(this, arguments);
            } else {
                this.use_original_menu = true;
                showSearchBox.apply(this, arguments);
                this.use_original_menu = false;
            }
        }

        /*
        To allow us to use the shift drag above, we need to intercept 'allow_searchbox' sometimes
        (because searchbox is the default behaviour when shift dragging)
        Broken #219
        */
        var original_allow_searchbox = app.canvas.allow_searchbox;
        defineProperty(app.canvas, 'allow_searchbox', {
            get : function() { 
                if (this.use_original_menu) { return original_allow_searchbox; }
                if(app.ui.settings.getSettingValue('AE.replacesearch') && this.connecting_output) {
                    return false;
                } else { return original_allow_searchbox; }
            },
            set : function(v) { original_allow_searchbox = v; }
        });
        

	},

    init() {
        graphAnalyser = GraphAnalyser.instance();
        app.graphToPrompt = async function () {
            return graphAnalyser.analyse_graph(true, true, false);
        }
        
        linkRenderController = LinkRenderController.instance(graphAnalyser);

        add_autoprompts();

        if (false) add_debug();

    }

});
