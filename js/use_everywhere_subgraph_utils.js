import { app } from "../../scripts/app.js";
import { Logger } from "./use_everywhere_utilities.js";

export function master_graph()    { return app.graph }
export function master_graph_id() { return master_graph().id }

export function visible_graph()    { return app.canvas.graph }

export function in_visible_graph(node) { 
    try {
        return node.graph.id == app.canvas.graph.id
    } catch (e) {
        Logger.log_error(e)
        return false
    }
}

export function get_subgraph_input_type(graph, slot) { return graph.inputNode.slots[slot].type }
export function link_is_from_subgraph_input(link) { return link.origin_id==-10 }

export function copy_ue_accepting(new_node) {
    try {
        const subgraph = new_node.subgraph
        subgraph.inputNode.slots.forEach((slot, i)=>{
            slot.linkIds.forEach((lid) => {
                const link = subgraph.links[lid]
                const target = subgraph._nodes_by_id[link.target_id]
                const slot_name = target.inputs[link.target_slot].name
                const ue_connectable = target.properties.ue_properties.widget_ue_connectable[slot_name]
                if (ue_connectable) {
                    const input_name = new_node.inputs[i]?.name
                    if (slot_name!=input_name) {
                        Logger.log_problem("In copy_ue_accepting names don't match")
                    } else {
                        new_node.properties.ue_properties.widget_ue_connectable[input_name] = true
                    }
                }
            })
        })
    } catch (e) {
        Logger.log_error(e, "in copy_ue_accepting")
    }

}

class WrappedInputNode {
    constructor(subgraph_input_node) {
        this.subgraph_input_node = subgraph_input_node;
        this.graph = subgraph_input_node.subgraph;
    }

    connect(output_index, input_node, input_index) {
        this.graph.last_link_id += 1
        this.graph.links[this.graph.last_link_id] = new LLink(this.graph.last_link_id, this.subgraph_input_node.slots[output_index].type, -10, output_index, input_node.id, input_index) 
        input_node.inputs[input_index].link = this.graph.last_link_id;
        this.subgraph_input_node.slots[output_index].linkIds.push(this.graph.last_link_id)
        return this.graph.links[this.graph.last_link_id]
    }

}
export function wrap_input(subgraph_input_node) {
    return new WrappedInputNode(subgraph_input_node);
}