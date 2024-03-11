import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { is_UEnode, is_helper, inject, Logger, get_real_node, get_group_node } from "./use_everywhere_utilities.js";
import { displayMessage, update_input_label, indicate_restriction } from "./use_everywhere_ui.js";
import { LinkRenderController } from "./use_everywhere_ui.js";
import { autoCreateMenu } from "./use_everywhere_autocreate.js";
import { convert_to_links, remove_all_ues } from "./use_everywhere_apply.js";
import { add_autoprompts } from "./use_everywhere_autoprompt.js";

import { GraphAnalyser } from "./use_everywhere_graph_analysis.js";

/*
The ui component that looks after the link rendering
*/
var _lrc;
var graphAnalyser;

/*
Inject a call to _lrc.mark_list_link_outdated into a method with name methodname on all objects in the array
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
    if (object) inject(object, methodname, tracetext, _lrc.mark_link_list_outdated, _lrc);
}

const nodeHandler = {
    set: function(obj, property, value) {
        const oldValue = Reflect.get(obj, property, this);
        const result = Reflect.set(...arguments);
        if (oldValue!=value) {
            if (property==='bgcolor') {
                obj.widgets?.forEach((widget) => {widget.colorFollower?.(value, obj.mode)});
                if (obj.mode!=4) _lrc.mark_link_list_outdated();
            }
            if (property==='mode') {
                _lrc.mark_link_list_outdated();
                if (oldValue==4) obj.widgets?.forEach((widget) => {widget.endBypass?.()});
            }
        }
        return result;
    },
    deleteProperty: function(obj, property) {
        if (property==='bgcolor') obj.widgets?.forEach((widget) => {widget.colorFollower?.(null, obj.mode)});
        return Reflect.deleteProperty(...arguments);
    }
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
                    this.input_type[slot] = (connect && link_info) ? get_real_node(link_info?.origin_id)?.outputs[link_info?.origin_slot]?.type 
                                                                : undefined;
                    update_input_label(this, slot, app);
                }
            }
            _lrc.mark_link_list_outdated();
            onConnectionsChange?.apply(this, arguments);
        };

        /*
        Toggle the group restriction.
        Any right click action on a node might make the link list dirty.
        */
        const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function(_, options) {
            Logger.trace("getExtraMenuOptions", arguments, this);
            getExtraMenuOptions?.apply(this, arguments);
            if (is_UEnode(this)) {
                options.push(null,
                    {
                        content: (this.properties.group_restricted) ? "Remove group restriction" : "Send only within my group(s)",
                        callback: () => { this.properties.group_restricted = !this.properties.group_restricted; }
                    }, 
                    {
                        content: (this.properties.color_restricted) ? "Remove color restriction" : "Send only to matching color",
                        callback: () => { this.properties.color_restricted = !this.properties.color_restricted; }
                    },
                    {
                        content: "Convert to real links",
                        callback: async () => {
                            const ues = await analyse_graph();
                            convert_to_links(ues, this.id);
                            app.graph.remove(this);
                        }
                    },
                null)
            }
            // any right click action can make the list dirty
            inject_outdating_into_objects(options,'callback',`menu option on ${this.id}`);
        }

        if (is_UEnode(nodeType)) {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                if (!this.properties) this.properties = {}
                this.properties.group_restricted = false;
                this.properties.color_restricted = false;
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
        node.IS_UE = is_UEnode(node);
        if (node.IS_UE) {
            node.input_type = [undefined, undefined, undefined]; // for dynamic input types
            node.displayMessage = displayMessage;                // receive messages from the python code           

            // If a widget on a UE node is edited, link list is dirty
            inject_outdating_into_objects(node.widgets,'callback',`widget callback on ${this.id}`);

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
        setTimeout( ()=>{_lrc.mark_link_list_outdated()}, 100 );


    }, 

    loadedGraphNode(node) { if (node.flags.collapsed && node.IS_UE) node.loaded_when_collapsed?.(); },

	async setup() {
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



        /*
        We don't want to do that if we are saving the workflow or api:
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
            _original_save_api_onclick();
            graphAnalyser.unpause()
        }
        
        /* 
        Hijack drawNode to render the virtual connection points
        and links to node with mouseOver
        */
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            original_drawNode.apply(this, arguments);
            _lrc.highlight_ue_connections(node, ctx);
            if (get_group_node(node.id).mouseOver) _lrc.render_mouseover(node, ctx);
        }

        /*
        When we draw connections, do the ue ones as well
        */
        const drawConnections = LGraphCanvas.prototype.drawConnections;
        LGraphCanvas.prototype.drawConnections = function(ctx) {
            drawConnections?.apply(this, arguments);
            _lrc.render_all_ue_links(ctx);
        }

        /* 
        Add to the settings menu 
        */
        app.ui.settings.addSetting({
            id: "AE.details",
            name: "Anything Everywhere show node details",
            type: "boolean",
            defaultValue: false,
        });
        app.ui.settings.addSetting({
            id: "AE.autoprompt",
            name: "Anything Everywhere? autocomplete (may require page reload)",
            type: "boolean",
            defaultValue: true,
        });
        app.ui.settings.addSetting({
            id: "AE.checkloops",
            name: "Anything Everywhere check loops",
            type: "boolean",
            defaultValue: true,
        });        
        app.ui.settings.addSetting({
            id: "AE.mouseover",
            name: "Anything Everywhere show links on mouse over",
            type: "boolean",
            defaultValue: false,
        });
        app.ui.settings.addSetting({
            id: "AE.animate",
            name: "Anything Everywhere animate UE links",
            type: "boolean",
            defaultValue: true,
        });
        app.ui.settings.addSetting({
            id: "AE.highlight",
            name: "Anything Everywhere highlight connected nodes",
            type: "boolean",
            defaultValue: true,
        });
        app.ui.settings.addSetting({
            id: "AE.replacesearch",
            name: "Anything Everywhere replace search",
            type: "boolean",
            defaultValue: true,
        });
        
        /* 
        Canvas menu is the right click on backdrop.
        We need to add our option, and hijack the others.
        */
        const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function () {
            // Add our items to the canvas menu 
            const options = original_getCanvasMenuOptions.apply(this, arguments);
            options.push(null); // divider
            options.push({
                content: (_lrc._ue_links_visible) ? "Hide UE links" : "Show UE links",
                callback: () => {
                    Logger.trace("Toggle visibility called", arguments);
                    _lrc.toggle_ue_links_visible();
                }
            },
            {
                content: "Convert all UEs to real links",
                callback: async () => {
                    const ues = await analyse_graph();
                    convert_to_links(ues, -1);
                    remove_all_ues();
                }
            });
            if (graphAnalyser.ambiguity_messages.length) {
                options.push({
                    content: "Show UE broadcast clashes",
                    callback: async () => { 
                        alert(graphAnalyser.ambiguity_messages.join("\n")) 
                    }
                })
            }
            options.push(null); // divider

            //  every menu item makes our list dirty
            inject_outdating_into_objects(options,'callback',`menu option on canvas`);

            return options;
        }

        /*
        When you drag from a node, showConnectionMenu is called. If shift key is pressed call ours
        */
        const original_showConnectionMenu = LGraphCanvas.prototype.showConnectionMenu;
        LGraphCanvas.prototype.showConnectionMenu = function (optPass) {
            if (optPass.e.shiftKey) {
                autoCreateMenu.apply(this, arguments);
            } else {
                this.use_original_menu = true;
                original_showConnectionMenu.apply(this, arguments);
                this.use_original_menu = false;
            }
        }

        /*
        To allow us to use the shift drag above, we need to intercept 'allow_searchbox' sometimes
        (because searchbox is the default behaviour when shift dragging)
        */
        var original_allow_searchbox = app.canvas.allow_searchbox;
        Object.defineProperty(app.canvas, 'allow_searchbox', {
            get : function() { 
                if (this.use_original_menu) { return original_allow_searchbox; }
                if(app.ui.settings.getSettingValue('AE.replacesearch', true) && this.connecting_output) {
                    return false;
                } else { return original_allow_searchbox; }
            },
            set : function(v) { original_allow_searchbox = v; }
        });
        
        /*
        most things that change the graph call afterChange
        */
        inject_outdating_into_object_method(app.graph, "afterChange", "graph.afterChange")

	},

    init() {
                /*
        The graphToPrompt method is called when the app is going to send a prompt to the server.
        We hijack it, call the original, and return a modified copy.
        _original_graphToPrompt defined as a var above
        */

        graphAnalyser = new GraphAnalyser();
        app.graphToPrompt = async function () {
            return graphAnalyser.analyse_graph(true, true);
        }
        _lrc = new LinkRenderController(graphAnalyser);
        add_autoprompts(_lrc);
        const createNode = LiteGraph.createNode;
        LiteGraph.createNode = function() {
            const nd = createNode.apply(this,arguments);
            return nd.IS_UE ? new Proxy( nd, nodeHandler ) : nd;
        }
    }

});
