import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { GroupNodeHandler } from "../core/groupNode.js";
import { UseEverywhereList } from "./use_everywhere_classes.js";
import { add_ue_from_node } from "./use_everywhere_nodes.js";
import { node_in_loop, node_is_live, is_connected, is_UEnode, is_helper, inject, Logger } from "./use_everywhere_utilities.js";
import { displayMessage, update_input_label, indicate_restriction } from "./use_everywhere_ui.js";
import { LinkRenderController } from "./use_everywhere_ui.js";
import { autoCreateMenu } from "./use_everywhere_autocreate.js";
import { convert_to_links, remove_all_ues } from "./use_everywhere_apply.js";

var _original_graphToPrompt; // gets populated with the original method in setup()
var _ambiguity_messages = [];
/*
Get the graph and analyse it.
If modify_and_return_prompt is true, apply UE modifications and return the prompt (for hijack)
If modify_and_return_prompt is false, jsut return the UseEverywhereList (for UI highlights etc) 
*/
async function analyse_graph(modify_and_return_prompt=false, check_for_loops=false) {
    _ambiguity_messages = [];
    var p = await _original_graphToPrompt.apply(app);
    if (modify_and_return_prompt) {
        p = structuredClone(p);
    } 
            
    // Create a UseEverywhereList and populate it from all live (not bypassed) nodes
    const ues = new UseEverywhereList();
    const live_nodes = p.workflow.nodes.filter((node) => node_is_live(node))
    live_nodes.filter((node) => is_UEnode(node)).forEach(node => { add_ue_from_node(ues, node); })

    const links_added = new Set();
    // Look for unconnected inputs and see if we can connect them
    live_nodes.filter((node) => !is_UEnode(node)).forEach(node => {
        const nd = app.graph._nodes_by_id[node.id];
        if (!nd) {
            Logger.log(Logger.INFORMATION, `Node ${node.id} not located`);
        } else {
            var gpData = GroupNodeHandler.getGroupData(nd);
            const isGrp = !!gpData;
            const o2n = isGrp ? Object.entries(gpData.oldToNewInputMap) : null;
            node.inputs?.forEach(input => {
                if (!is_connected(input)) {
                    var ue = ues.find_best_match(node, input, _ambiguity_messages);
                    if (ue && modify_and_return_prompt) {
                        var effective_node = node;
                        var effective_node_slot = -1;
                        if (isGrp) { // the node we are looking at is a group node
                            const in_index = node.inputs.findIndex((i)=>i==input);
                            const inner_node_index = o2n.findIndex((l)=>Object.values(l[1]).includes(in_index));
                            const inner_node_slot_index = Object.values(o2n[inner_node_index][1]).findIndex((l)=>l==in_index);
                            effective_node_slot = Object.keys(o2n[inner_node_index][1])[inner_node_slot_index];
                            effective_node = nd.getInnerNodes()[inner_node_index];
                        }
                        const upNode = app.graph._nodes_by_id[ue.output[0]];
                        var effective_output = [ue.output[0], ue.output[1]];
                        if (GroupNodeHandler.isGroupNode(upNode)) { // the upstream node is a group node
                            const upGpData = GroupNodeHandler.getGroupData(upNode);
                            const up_inner_node = upGpData.newToOldOutputMap[ue.output[1]].node;
                            const up_inner_node_index = up_inner_node.index;
                            const up_inner_node_id = upNode.getInnerNodes()[up_inner_node_index].id;
                            const up_inner_node_slot = upGpData.newToOldOutputMap[ue.output[1]].slot;
                            effective_output = [`${up_inner_node_id}`, up_inner_node_slot];
                        } 
                        if (effective_node_slot==-1) effective_node_slot = effective_node.inputs.findIndex((i)=>(i.label ? i.label : i.name)===(input.label ? input.label : input.name));
                        p.output[effective_node.id].inputs[effective_node.inputs[effective_node_slot].name] = effective_output;
                        links_added.add({
                            "downstream":effective_node.id, "downstream_slot":effective_node_slot,
                            "upstream":effective_output[0], "upstream_slot":effective_output[1], 
                            "controller":ue.controller.id,
                            "type":ue.type
                        });
                    }
                }
            });
        }
    });

    // if there are loops report them and raise an exception
    if (check_for_loops && app.ui.settings.getSettingValue('AE.checkloops', true)) {
        try {
            node_in_loop(live_nodes, links_added);
        } catch (e) {
            if (!e.stack) throw e;
            if (e.ues && e.ues.length > 0){
                alert(`Loop (${e.stack}) with broadcast (${e.ues}) - not submitting workflow`);
            } else {
                alert(`Loop (${e.stack}) - not submitting workflow`);
            }
            throw new Error(`Loop Detected ${e.stack}, ${e.ues}`, {"cause":e});
        }
    }

    if (modify_and_return_prompt) {
        [...links_added].forEach((l)=>{
            p.workflow.last_link_id += 1;
            p.workflow.links.push([p.workflow.last_link_id, parseInt(l.upstream), l.upstream_slot, l.downstream, l.downstream_slot, l.type])
        })
        return p;
    }
    else return ues;
}

/*
The ui component that looks after the link rendering
*/
const _lrc = new LinkRenderController(analyse_graph);

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
                    this.input_type[slot] = (connect && link_info) ? this.graph?._nodes_by_id[link_info?.origin_id]?.outputs[link_info?.origin_slot]?.type 
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

        // mark outdated when changing the color of a node
        Object.defineProperty(node, 'color', {
            get : function() { return this._color; },
            set : function(v) { this._color = v; _lrc.mark_link_list_outdated(); }
        });
    },

	async setup() {
        /*
        Listen for message-handler event from python code
        */
        function messageHandler(event) {
            const id = event.detail.id;
            const message = event.detail.message;
            const node = app.graph._nodes_by_id[id];
            if (node && node.displayMessage) node.displayMessage(id, message);
            else (console.log(`node ${id} couldn't handle a message`));
        }
        api.addEventListener("ue-message-handler", messageHandler);

        /*
        The graphToPrompt method is called when the app is going to send a prompt to the server.
        We hijack it, call the original, and return a modified copy.
        _original_graphToPrompt defined as a var above
        */
        var do_modify = true;
        _original_graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            if (do_modify) {
                return analyse_graph(true, true);
            } else {
                return _original_graphToPrompt.apply(app)
            }
        }

        /*
        We don't want to do that if we are saving the workflow or api:
        */
        const _original_save_onclick = document.getElementById('comfy-save-button').onclick;
        document.getElementById('comfy-save-button').onclick = function() {
            const do_modify_was = do_modify
            do_modify = false;
            _original_save_onclick();
            do_modify = do_modify_was;
        }
        const _original_save_api_onclick = document.getElementById('comfy-dev-save-api-button').onclick;
        document.getElementById('comfy-dev-save-api-button').onclick = function() {
            const do_modify_was = do_modify
            do_modify = false;
            _original_save_api_onclick();
            do_modify = do_modify_was;
        }
        
        /* 
        Hijack drawNode to render the virtual links if requested
        */
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            // don't trace - this is called way too often!
            original_drawNode.apply(this, arguments);
            _lrc.render_ue_links(node, ctx);
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
            if (_ambiguity_messages.length) {
                options.push({
                    content: "Show UE broadcast clashes",
                    callback: async () => { 
                        alert(_ambiguity_messages.join("\n")) 
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

});
