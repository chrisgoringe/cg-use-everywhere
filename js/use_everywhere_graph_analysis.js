import { UseEverywhereList } from "./use_everywhere_classes.js";
import { node_is_live, is_connected, is_UEnode, Logger, Pausable, node_can_broadcast } from "./use_everywhere_utilities.js";
import { convert_to_links } from "./use_everywhere_apply.js";
import { app } from "../../scripts/app.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { is_connectable } from "./use_everywhere_settings.js";
import { for_all_graphs } from "./recursive_callbacks.js";
import { shared } from "./shared.js";

class GraphAnalyser extends Pausable {

    constructor() {
        super('GraphAnalyser')
        this.original_graphToPrompt = app.graphToPrompt;
        this.ambiguities = [];
        this.latest_ues = null
        this.mods = []
    }

    modify_graph(graph) {
        const ues = this.analyse_graph(graph, true)
        if (ues===null) {
            Logger.log_problem(`modify_graph called but no ues could be obtained for ${graph.id}`)
            console.trace()
        }
        const modifications = convert_to_links( ues, null, graph )
        this.mods.push( modifications );
        if (!graph.extra) graph.extra = {}
        graph.extra['links_added_by_ue'] = modifications.added_links.map(x=>x.id)
    }

    modify_all_graphs() {
        for_all_graphs(this.modify_graph.bind(this))
    }

    async call_function_with_modified_graph( func, args ) {
        var result
        this.mods = []
        try {
            this.pause('call_function_with_modified_graph')
            Logger.log_info("Modifying graphs")
            this.modify_all_graphs()
            shared.graph_currently_modified += 1
            result = await (args ? func(...args) : func())
        } catch (e) {
            Logger.log_error(e)
        }

        Logger.log_info("Unmodifying graphs")
        this.mods.forEach((mod)=>{
            try {mod.restorer()}
            catch (e) {Logger.log_error(e)}
        })
        this.mods = []
        shared.graph_currently_modified -= 1
        this.unpause()

        return result
    }

    
    clean_slots(links, slots) {
        slots?.forEach((slot)=>{
            if (slot.linkIds.find((lid)=>(!links[lid]))) {
                slot.linkIds = slot.linkIds.filter((lid)=>{ return links[lid] !== undefined })
            }
        })
    }

    analyse_graph(graph, ignore_pause) {
        if (this.paused() && !ignore_pause) return null

        /* work around known bug in ComfyUI front end that doesn't clean up the linkIds
        https://github.com/Comfy-Org/ComfyUI_frontend/issues/5673#issuecomment-3314310014

        Fixed? Doesn't seems to be.
        https://github.com/Comfy-Org/ComfyUI_frontend/pull/6258 */
        

        this.clean_slots(graph.links, graph.inputNode?.slots)
        this.clean_slots(graph.links, graph.outputNode?.slots)  

        this.ambiguities = [];
        const treat_bypassed_as_live = settingsCache.getSettingValue("Use Everywhere.Options.connect_to_bypassed") || this.connect_to_bypassed
        const live_nodes = graph.nodes.filter((node) => node_is_live(node, treat_bypassed_as_live))
                
        // Create a UseEverywhereList and populate it from all live (not bypassed) UE nodes
        const ues = new UseEverywhereList();
        live_nodes.filter((node) => node_can_broadcast(node)).filter((node)=>node_is_live(node,false)).forEach(node => { ues.add_ue_from_node(node); })

        // List all unconnected inputs on non-UE nodes which are connectable
        const connectable = []
        live_nodes.filter((node) => !is_UEnode(node)).forEach(node => {
            if (node && !node.properties.rejects_ue_links) {
                //if (!real_node._widget_name_map) real_node._widget_name_map =  real_node.widgets?.map(w => w.name) || [];
                node.inputs?.forEach((input,index) => {
                    if (!input) return; // NoteNode has input = [undefined,] !
                    if (is_connected(input, treat_bypassed_as_live, node.graph)) return;  
                    if (node.reject_ue_connection && node.reject_ue_connection(input)) return;
                    if (is_connectable(node, input.name)) connectable.push({node, input, index});
                })
            }
        })

        if (graph.outputNode) {
            graph.outputNode.slots.filter((slot)=>(slot.linkIds.length==0)).forEach((slot,index)=>{
                connectable.push({node:graph.outputNode, input:slot, index});
            }
        )}

        // see if we can connect them
        const links_added = new Set();
        connectable.forEach(({node, input, index}) => {
            var ue = ues.find_best_match(node, input, this.ambiguities);
            if (ue) {
                links_added.add({
                    "downstream":node.id, "downstream_slot":index,
                    "upstream":ue.output[0], "upstream_slot":ue.output[1], 
                    "controller":ue.controller.id,
                    "type":ue.type
                });
            }
        });

        graph.extra['ue_links'] = Array.from(links_added)
    
        if (this.ambiguities.length) Logger.log_info("Ambiguous connections", this.ambiguities, true);
 
        this.latest_ues = ues;
        return this.latest_ues;
    }
}

export { GraphAnalyser }
