import { app } from "../../scripts/app.js";
import { display_name } from "./use_everywhere_classes.js";
import { master_graph, node_graph } from "./use_everywhere_subgraph_utils.js";
import { is_UEnode, get_real_node, Logger } from "./use_everywhere_utilities.js";


function _convert_to_links(ue, added_links, removed_links) {
    const output_node_id = ue.output[0];
    const output_index = ue.output[1];
    const output_node = get_real_node(output_node_id, ue.graph);
    Logger.log_info("Adding links for " + ue.description);
    ue.sending_to.forEach((st) => {
        const input_node_id = st.node.id;
        const input_node = get_real_node(input_node_id, ue.graph);
        const input_index = st.input_index;
        if (input_node.inputs[input_index].link) {
            const llink = app.graph.links[input_node.inputs[input_index].link]
            removed_links.push( {...llink} )
        }
        const new_link = output_node.connect(output_index, input_node, input_index);
        if (!new_link)
            console.error("Failed to connect nodes: " +
                          `${output_node_id}[${output_index}] -> ` +
                          `${input_node_id}[${input_index}].`);
        else { // Memorize the links we are adding to remove them later
            if (added_links) added_links.push(new_link.id);
            Logger.log_info(`  -> ${display_name(st.node)}, ${st.input.name} ` +
                                           `(${st.node.id}.${st.input_index}) (ID: ${new_link.id})`);
        }
    });
}

function find_link_to_subgraph_node(id) {
    const last_node = app.graph._nodes_by_id[app.graph.last_node_id];
    const the_input = last_node.inputs.find(input => input.linkIds.includes(id));
    if (!the_input) throw new Error(`Link ID ${id} not found in inputs of most recently added node`);
    return the_input.link
}

function convert_to_links(ues, control_node, graph) {
    if (control_node) {
        if (!graph) graph = node_graph(control_node)
        return _convert_graph_to_links(graph, ues, control_node.id );
    } else {
        if (!graph) graph = master_graph();
        return _convert_graph_to_links(graph, ues, undefined);
    }
}

function _convert_graph_to_links(graph, ues, control_node_id) {
    const added_links = []
    const removed_links = []
    ues.ues.forEach((ue)=> {
        if (control_node_id==undefined || ue.controller.id == control_node_id) _convert_to_links(ue, added_links, removed_links);
    });

    const restorer = function() {
        added_links.forEach(id => { 
            try {
                if (graph.links[id]) {
                    graph.removeLink(id);   // the link still exists, so remove it
                } else {
                    id = find_link_to_subgraph_node(id)
                    graph.removeLink(id)
                }
            } catch (e) {
                Logger.log_error(e);
            }
        });

        removed_links.forEach(llink => {
            graph._nodes_by_id[llink.origin_id].connect(llink.origin_slot, graph._nodes_by_id[llink.target_id], llink.target_slot)
        })
    };

    return {restorer:restorer, added_links:added_links}
}

function remove_this(node, keep_seed_everywhere) {
    return  (is_UEnode(node) && !(keep_seed_everywhere && node.comfyClass=="Seed Everywhere") ) 
}

function remove_all_ues(keep_seed_everywhere) {
    app.graph._nodes.filter((node)=>remove_this(node, keep_seed_everywhere)).forEach((node)=>{app.graph.remove(node)})
}

export {convert_to_links, remove_all_ues}