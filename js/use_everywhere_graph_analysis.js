import { GroupNodeHandler } from "../core/groupNode.js";
import { UseEverywhereList, display_name } from "./use_everywhere_classes.js";
import { add_ue_from_node, add_ue_from_node_in_group } from "./use_everywhere_nodes.js";
import { node_in_loop, node_is_live, is_connected, is_UEnode, Logger, get_real_node } from "./use_everywhere_utilities.js";
import { convert_to_links } from "./use_everywhere_apply.js";
import { UpdateBlocker } from "./use_everywhere_ui.js";
import { app } from "../../scripts/app.js";

class GraphAnalyser {
    static _instance;
    static instance() {
        if (!this._instance) this._instance = new GraphAnalyser();
        return this._instance;
    }

    constructor() {
        this.original_graphToPrompt = app.graphToPrompt;
        this.ambiguity_messages = [];
        this.pause_depth = 0;
    }

    pause() { this.pause_depth += 1; }
    unpause() { this.pause_depth -= 1; }

    async graph_to_prompt(cur_list) {
        var p;
        // Convert the virtual links into real connections
        const addedLinks = [];
        UpdateBlocker.push();  // Block updates while we modify the connections
        try { // For each UseEverywhere object add its connections
            convert_to_links(cur_list, -1, addedLinks);
            // Now create the prompt using the ComfyUI original functionality and the patched graph
            p = await this.original_graphToPrompt.apply(app);
            // Remove the added virtual links
            addedLinks.forEach(id => { app.graph.removeLink(id); });
        } finally { UpdateBlocker.pop(); }
        try {
            p = JSON.parse(JSON.stringify(p));
        } catch (error) {
            console.error("Error during JSON cloning:", error);
            return null;
        }
        return p;
    }

    async analyse_graph(check_for_loops=false) {
        if (this.pause_depth > 0) { return this.original_graphToPrompt.apply(app) }
        this.ambiguity_messages = [];
        var p = { workflow:app.graph.serialize() };
                
        // Create a UseEverywhereList and populate it from all live (not bypassed) nodes
        const ues = new UseEverywhereList();
        const live_nodes = p.workflow.nodes.filter((node) => node_is_live(node))
        live_nodes.filter((node) => is_UEnode(node)).forEach(node => { add_ue_from_node(ues, node); })
        live_nodes.filter((node) => (get_real_node(node.id, Logger.INFORMATION) && GroupNodeHandler.isGroupNode(get_real_node(node.id)))).forEach( groupNode => {
            const group_data = GroupNodeHandler.getGroupData(get_real_node(groupNode.id));
            group_data.nodeData.nodes.filter((node) => is_UEnode(node)).forEach(node => { 
                add_ue_from_node_in_group(ues, node, groupNode.id, group_data); 
            })
        })
    
        const links_added = new Set();
        // Look for unconnected inputs and see if we can connect them
        live_nodes.filter((node) => !is_UEnode(node)).forEach(node => {
            const nd = get_real_node(node.id, Logger.INFORMATION);
            if (nd && !nd.properties.rejects_ue_links) {
                var gpData = GroupNodeHandler.getGroupData(nd);
                const isGrp = !!gpData;
                const o2n = isGrp ? Object.entries(gpData.oldToNewInputMap) : null;
                const o2w = isGrp ? Object.entries(gpData.oldToNewWidgetMap) : null;
                nd.inputs?.forEach(input => {
                    if (!is_connected(input) && !(node.reject_ue_connection && node.reject_ue_connection(input))) {
                        var ue = ues.find_best_match(node, input, this.ambiguity_messages);
                        if (ue) {
                            var effective_node = node;
                            var effective_node_slot = -1;
                            if (isGrp) { // the node we are looking at is a group node
                                const in_index = nd.inputs.findIndex((i)=>i==input);
                                var inner_node_index = o2n.findIndex((l)=>Object.values(l[1]).includes(in_index));
                                if (inner_node_index==-1) {
                                    // Should be a widget
                                    inner_node_index = o2w.findIndex((l)=>Object.values(l[1]).includes(input.name));
                                }
                                const inner_node_slot_index = Object.values(o2n[inner_node_index][1]).findIndex((l)=>l==in_index);
                                effective_node_slot = Object.keys(o2n[inner_node_index][1])[inner_node_slot_index];
                                effective_node = nd.getInnerNodes()[o2n[inner_node_index][0]];
                            }
                            const upNode = get_real_node(ue.output[0]);
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

        app.graph.extra['ue_links'] = Array.from(links_added)
    
        if (this.ambiguity_messages.length) Logger.log(Logger.PROBLEM, "Ambiguous connections", this.ambiguity_messages, Logger.CAT_AMBIGUITY);
    
        // if there are loops report them and raise an exception
        if (check_for_loops && app.ui.settings.getSettingValue('AE.checkloops')) {
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

        return ues;
    }
}

export { GraphAnalyser }
