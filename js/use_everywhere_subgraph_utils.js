import { app } from "../../scripts/app.js";

export function master_graph()    { return app.graph }
export function master_graph_id() { return master_graph().id }

export function visible_graph()    { return app.canvas.graph }
export function visible_graph_id() { return visible_graph().id }

export function node_graph(node)    { return node.graph }
export function node_graph_id(node) { return node_graph(node).id }

export function in_visible_graph(node) { return node_graph_id(node) == visible_graph_id() }
