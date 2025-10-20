import { app } from "../../scripts/app.js";
import { ue_callbacks } from "./recursive_callbacks.js";
import { Logger } from "./use_everywhere_utilities.js";
import { shared } from "./shared.js";

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

export function connection_from_output_as_input(node, slot) {
    try {
        return {
            type : node.outputs[slot].type, 
            link : {
                origin_id   : node.id, 
                origin_slot : slot,
            },
        }
    } catch (e) {
        console.error(e)
        return false
    }
}

export function fix_new_subgraph_node(node) {
    try {
        const subgraph = node.subgraph
        subgraph.inputNode.slots.forEach((slot, i)=>{
            slot.linkIds.forEach((lid) => {
                const link = subgraph.links[lid]
                const target = subgraph._nodes_by_id[link.target_id]
                const slot_name = target.inputs[link.target_slot].name
                const ue_connectable = target.properties.ue_properties.widget_ue_connectable[slot_name]
                if (ue_connectable) {
                    const input_name = node.inputs[i]?.name
                    if (slot_name!=input_name) {
                        Logger.log_problem("In fix_new_subgraph names don't match")
                    } else {
                        node.properties.ue_properties.widget_ue_connectable[input_name] = true
                    }
                }
            })
        })
    } catch (e) {
        Logger.log_error(e, "in fix_new_subgraph")
    }
}

function fix_subgraph_widgets(node) {
    return 
    // some code for Issue 390 - fixing widgets on subgraph nodes - which doesn't work yet
    const graph = node.subgraph
    const widgets = node.widgets
    if (!graph) return
    shared.graphAnalyser.analyse_graph(graph, true)
    node.inputs.forEach((input,slot)=>{
        if (!input.widget) {
            const connected_widgets = graph.extra['ue_links'].
                filter((uel)=>(uel.upstream=="-10" && uel.upstream_slot==slot)).    
                map((uel)=>graph._nodes_by_id[uel.downstream]?.inputs[uel.downstream_slot]?.widget).
                filter((w)=>(w))
            if (connected_widgets.length>0) {
                const new_widget = node.addWidget()
                input._widget = new_widget
                input.widget = {name:new_widget.name}
            }
        }
    })
}
ue_callbacks.register_allnode_callback('afterConfigureGraph', fix_subgraph_widgets, true )

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