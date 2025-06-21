import { app } from "../../scripts/app.js";

export function visible_graph() { return app.canvas.graph }
export function visible_graph_id() { return app.canvas.graph.id }
export function node_graph_id(node) { return node.graph.id }
export function in_visible_graph(node) { return node_graph_id(node) == visible_graph_id() }