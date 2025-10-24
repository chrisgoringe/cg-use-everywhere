import { UseEverywhereList } from "./use_everywhere_classes.js";
import { node_is_live, is_connected, is_UEnode, Logger, Pausable } from "./use_everywhere_utilities.js";
import { convert_to_links } from "./use_everywhere_apply.js";
import { app } from "../../scripts/app.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { visible_graph } from "./use_everywhere_subgraph_utils.js";
import { is_connectable } from "./use_everywhere_settings.js";
import { for_all_graphs } from "./recursive_callbacks.js";

class GraphAnalyser extends Pausable {

    constructor() {
        super('GraphAnalyser')
        this.original_graphToPrompt = app.graphToPrompt;
        this.ambiguity_messages = [];
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

    async graph_to_prompt() {
        var p;
        this.pause('graph_to_prompt')
        this.mods = []
        try { 
            for_all_graphs(this.modify_graph.bind(this))
            // Now create the prompt using the ComfyUI original functionality and the patched graph
            p = await this.original_graphToPrompt.apply(app);
        } catch (e) { 
            Logger.log_error(e)
        } finally { 
            try {
                this.mods.forEach((mod)=>{mod.restorer()})
                this.mods = []
            } finally {
                this.unpause()
            }
        }

        if (!p) {
            Logger.log_problem("graph_to_prompt_fallback")
            p = await this.original_graphToPrompt.apply(app);
        }
        
        return p;
    }

    analyse_graph(graph, ignore_pause) {
        if (this.paused() && !ignore_pause) return null

        this.ambiguity_messages = [];
        const treat_bypassed_as_live = settingsCache.getSettingValue("Use Everywhere.Options.connect_to_bypassed") || this.connect_to_bypassed
        const live_nodes = graph.nodes.filter((node) => node_is_live(node, treat_bypassed_as_live))
                
        // Create a UseEverywhereList and populate it from all live (not bypassed) UE nodes
        const ues = new UseEverywhereList();
        live_nodes.filter((node) => is_UEnode(node, true)).filter((node)=>node_is_live(node,false)).forEach(node => { ues.add_ue_from_node(node); })

        // List all unconnected inputs on non-UE nodes which are connectable
        const connectable = []
        live_nodes.filter((node) => !is_UEnode(node, false)).forEach(node => {
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

        // see if we can connect them
        const links_added = new Set();
        connectable.forEach(({node, input, index}) => {
            var ue = ues.find_best_match(node, input, this.ambiguity_messages);
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
    
        if (this.ambiguity_messages.length) Logger.log_info("Ambiguous connections", this.ambiguity_messages, true);
 
        this.latest_ues = ues;
        return this.latest_ues;
    }
}

export { GraphAnalyser }
