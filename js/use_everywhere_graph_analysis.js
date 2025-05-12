import { GroupNodeHandler } from "../core/groupNode.js";
import { UseEverywhereList } from "./use_everywhere_classes.js";
import { add_ue_from_node, add_ue_from_node_in_group } from "./use_everywhere_nodes.js";
import { node_in_loop, node_is_live, is_connected, is_UEnode, Logger, get_real_node, Pausable } from "./use_everywhere_utilities.js";
import { convert_to_links } from "./use_everywhere_apply.js";
import { app } from "../../scripts/app.js";
import { settingsCache } from "./use_everywhere_cache.js";

class GraphAnalyser extends Pausable {
    static _instance;
    static instance() {
        if (!this._instance) this._instance = new GraphAnalyser();
        return this._instance;
    }

    constructor() {
        super('GraphAnalyser')
        this.original_graphToPrompt = app.graphToPrompt;
        this.ambiguity_messages = [];
    }

    async graph_to_prompt(cur_list) {
        var p;
        // Convert the virtual links into real connections
        this.pause('graph_to_prompt')
        try { // For each UseEverywhere object add its connections
            const mods = convert_to_links(cur_list, -1);
            // Now create the prompt using the ComfyUI original functionality and the patched graph
            app.graph.extra['links_added_by_ue'] = mods.added_links;
            p = await this.original_graphToPrompt.apply(app);
            // Remove the added virtual links
            mods.restorer()
            //addedLinks.forEach(id => { app.graph.removeLink(id); });
        } catch (e) { 
            Logger.log_error(Logger.ERROR,e)
        } finally { 
            this.unpause()
        }

        return p;
    }

    analyse_graph(wait_if_blocked, about_to_submit) {
        if (this.paused()) { 
            if (wait_if_blocked) {
                Logger.log_error(Logger.ERROR, "Don't know how to wait")
            } 
            return null
        }
        this.ambiguity_messages = [];
        var p = { workflow:app.graph.serialize() };
        const treat_bypassed_as_live = settingsCache.getSettingValue("Use Everywhere.Options.connect_to_bypassed")
        const live_nodes = p.workflow.nodes.filter((node) => node_is_live(node, treat_bypassed_as_live))
                
        // Create a UseEverywhereList and populate it from all live (not bypassed) UE nodes
        const ues = new UseEverywhereList();
        live_nodes.filter((node) => is_UEnode(node)).forEach(node => { add_ue_from_node(ues, node); })
        // and nodes in group nodes
        live_nodes.filter((node) => (get_real_node(node.id, Logger.DETAIL) && GroupNodeHandler.isGroupNode(get_real_node(node.id)))).forEach( groupNode => {
            const group_data = GroupNodeHandler.getGroupData(get_real_node(groupNode.id));
            group_data.nodeData.nodes.filter((node) => is_UEnode(node)).forEach(node => { 
                add_ue_from_node_in_group(ues, node, groupNode.id, group_data); 
            })
        })
    
        
        // List all unconnected inputs on non-UE nodes which are connectable
        const connectable = []
        live_nodes.filter((node) => !is_UEnode(node)).forEach(node => {
            const real_node = get_real_node(node.id, Logger.DETAIL);

            if (real_node && !real_node.properties.rejects_ue_links) {
                var gpData = GroupNodeHandler.getGroupData(real_node);
                const isGrp = !!gpData;
                const o2n = isGrp ? Object.entries(gpData.oldToNewInputMap) : null;
                //if (!real_node._widget_name_map) real_node._widget_name_map =  real_node.widgets?.map(w => w.name) || [];
                real_node.inputs?.forEach((input,index) => {
                    if (is_connected(input, treat_bypassed_as_live)) return;  
                    if (real_node.reject_ue_connection && real_node.reject_ue_connection(input)) return;
                    if (real_node._getWidgetByName(input.name) && !(real_node.properties['widget_ue_connectable'] && real_node.properties['widget_ue_connectable'][input.name])) return;
                    connectable.push({node, input, index, isGrp, real_node, o2n});
                })
            }
        })

        // see if we can connect them
        const links_added = new Set();
        connectable.forEach(({node, input, index, isGrp, real_node, o2n}) => {
            /*
            if isGrp, then
            node refers to the outer node (group node), real_node to the inner node.
            input and index are on real_node
            if not isGRp, node==real_node
            */

            var ue = ues.find_best_match(real_node, input, this.ambiguity_messages);
            if (ue) {
                const upstream_node_id   = ue.output[0]
                const real_upstream_node = get_real_node(upstream_node_id);
                var effective_output = [ue.output[0], ue.output[1]];  // [node_id, slot]


                if (upstream_node_id!=real_upstream_node.id) { // the upstream node is a group node, so get the inner node and slot
                    const upGpData = GroupNodeHandler.getGroupData(real_upstream_node);
                    const up_inner_node = upGpData.newToOldOutputMap[ue.output[1]].node;
                    const up_inner_node_index = up_inner_node.index;
                    const up_inner_node_id = real_upstream_node.getInnerNodes()[up_inner_node_index].id;
                    const up_inner_node_slot = upGpData.newToOldOutputMap[ue.output[1]].slot;
                    effective_output = [`${up_inner_node_id}`, up_inner_node_slot];
                }


                links_added.add({
                    //"downstream":real_target_node.id, "downstream_slot":real_target_node_slot,
                    "downstream":real_node.id, "downstream_slot":index,
                    "upstream":effective_output[0], "upstream_slot":effective_output[1], 
                    "controller":ue.controller.id,
                    "type":ue.type
                });
            }
        });

        app.graph.extra['ue_links'] = Array.from(links_added)
    
        if (this.ambiguity_messages.length) Logger.log(Logger.PROBLEM, "Ambiguous connections", this.ambiguity_messages, Logger.CAT_AMBIGUITY);
    
        // if there are loops report them and raise an exception
        if (about_to_submit && settingsCache.getSettingValue('Use Everywhere.Options.checkloops')) {
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
