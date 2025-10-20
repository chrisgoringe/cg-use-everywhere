import { app } from "../../scripts/app.js";

class RecursiveCallbacks {
    constructor() {
        this.event_to_node_callbacklist = {}
        this.event_to_graph_callbacklist = {}
    }

    /*
    Register a callback for a named event.
    */
    register_allnode_callback(event, call, first) {
        if (!this.event_to_node_callbacklist[event]) this.event_to_node_callbacklist[event] = []
        if (first) this.event_to_node_callbacklist[event].unshift(call)
        else this.event_to_node_callbacklist[event].push(call)
    }
    register_allgraph_callback(event, call, first) {
        if (!this.event_to_graph_callbacklist[event]) this.event_to_graph_callbacklist[event] = []
        if (first) this.event_to_graph_callbacklist[event].push(call)
        else this.event_to_graph_callbacklist[event].push(call)
    }



    /*
    For every callback registered to this event, 
    call allnode callback once for each node, with the node as argument
    call allgraph callback once for each node, with the graph as argument
    */
    dispatch(event) {
        if (this.event_to_node_callbacklist[event]) {
            this.event_to_node_callbacklist[event].forEach((callback) => {
                _node_dispatch(callback, app.graph)
            });
        }
        if (this.event_to_graph_callbacklist[event]) {
            this.event_to_graph_callbacklist[event].forEach((callback) => {
                _graph_dispatch(callback, app.graph)
            });
        }
    }
}

function _node_dispatch(callback, graph) {
    graph.nodes.forEach((node) => {
        callback(node)
        if (node.subgraph) { _node_dispatch(callback, node.subgraph) }
    })
}

function _graph_dispatch(callback, graph) {
    callback(graph)
    graph.nodes.filter((node)=>(node.subgraph)).forEach((node) => { _graph_dispatch(callback, node.subgraph) })
}

export const ue_callbacks = new RecursiveCallbacks()

export function for_all_graphs(callback) {
    _graph_dispatch(callback, app.graph)
}

export function for_all_nodes(callback) {
    _node_dispatch(callback, app.graph)
}