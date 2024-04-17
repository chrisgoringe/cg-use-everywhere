import { app } from "../../scripts/app.js";
import { GroupNodeHandler } from "../core/groupNode.js";

class Logger {
    static ERROR       = 0; // actual errors
    static PROBLEM     = 1; // things that stop the workflow working
    static INFORMATION = 2; // record of good things
    static DETAIL      = 3; // details

    static LEVEL = Logger.PROBLEM;
    static TRACE = false;   // most of the method calls

    static CAT_AMBIGUITY = 1;
    static last_reported_category = {};
    static category_cooloff = { 1 : 5000 }

    static log(level, message, array, category) {
        if (category && Logger.last_reported_category[category]) {
            const elapsed = (new Date()) - Logger.last_reported_category[category];
            if (elapsed < Logger.category_cooloff[category]) return;
        }
        if (level <= Logger.LEVEL) {
            console.log(message);
            if (array) for (var i=0; i<array.length; i++) { console.log(array[i]) }
            if (category) Logger.last_reported_category[category] = new Date();
        }
    }

    static log_call(level, method) {
        if (level <= Logger.LEVEL) {
            method.apply();
        }
    }

    static log_error(level, message) {
        if (level <= Logger.LEVEL) {
            console.error(message);
        }
    }

    static trace(message, array, node) {
        if (Logger.TRACE) {
            if (node) { console.log(`TRACE (${node.id}) : ${message}`) } else { console.log(`TRACE : ${message}`) }
            if (array && Logger.LEVEL>=Logger.INFORMATION) for (var i=0; i<array.length; i++) { console.log(`  ${i} = ${array[i]}`) }
        }
    }
}

class LoopError extends Error {
    constructor(id, stack, ues) {
        super("Loop detected");
        this.id = id;
        this.stack = [...stack];
        this.ues = [...ues];
    }
}

function find_all_upstream(node_id, links_added) {
    const all_upstream = [];
    const node = get_real_node(node_id);
    node?.inputs?.forEach((input) => { // normal links
        const link_id = input.link;
        if (link_id) {
            const link = app.graph.links[link_id];
            if (link) all_upstream.push({id:link.origin_id, slot:link.origin_slot});
        }
    });
    links_added.forEach((la)=>{ // UE links
        if (get_real_node(la.downstream).id==node.id) {
            all_upstream.push({id:la.upstream, slot:la.upstream_slot, ue:la.controller.toString()})
        }
    });
    if (node.id != get_group_node(node.id).id) { // node is in group
        const grp_nd = get_group_node(node.id).id;
        const group_data = GroupNodeHandler.getGroupData(get_group_node(node.id));
        const indx = group_data.nodeData.nodes.findIndex((n)=>n.pos[0]==node.pos[0] && n.pos[1]==node.pos[1]);
        if (indx>=0) {
            if (GroupNodeHandler.getGroupData(app.graph._nodes_by_id[grp_nd])?.linksTo?.[indx] ) { // links within group
                Object.values(GroupNodeHandler.getGroupData(app.graph._nodes_by_id[grp_nd]).linksTo[indx]).forEach((internal_link) => {
                    all_upstream.push({id:`${grp_nd}:${internal_link[0]}`, slot:internal_link[1]});
                });
            }
            if (GroupNodeHandler.getGroupData(app.graph._nodes_by_id[grp_nd]).oldToNewInputMap?.[indx]) { // links out of group
                Object.values(GroupNodeHandler.getGroupData(app.graph._nodes_by_id[grp_nd]).oldToNewInputMap?.[indx]).forEach((groupInput) => {
                    const link_id = get_group_node(node.id).inputs?.[groupInput]?.link;
                    if (link_id) {
                        const link = app.graph.links[link_id];
                        if (link) all_upstream.push({id:link.origin_id, slot:link.origin_slot});
                    }
                })
            }
        }
    }
    return all_upstream;
}

function recursive_follow(node_id, start_node_id, links_added, stack, nodes_cleared, ues, count, slot) {
    const node = get_real_node(node_id);
    if (slot>=0 && GroupNodeHandler.isGroupNode(node)) { // link into group
        const mapped = GroupNodeHandler.getGroupData(node).newToOldOutputMap[slot];
        return recursive_follow(`${node.id}:${mapped.node.index}`, start_node_id, links_added, stack, nodes_cleared, ues, count, mapped.slot);
    }
    count += 1;
    if (stack.includes(node.id.toString())) throw new LoopError(node.id, new Set(stack), new Set(ues));
    if (nodes_cleared.has(node.id.toString())) return;
    stack.push(node.id.toString());

    find_all_upstream(node.id, links_added).forEach((upstream) => {
        if (upstream.ue) ues.push(upstream.ue);
        count = recursive_follow(upstream.id, start_node_id, links_added, stack, nodes_cleared, ues, count, upstream.slot);
        if (upstream.ue) ues.pop();
    })

    nodes_cleared.add(node.id.toString());
    stack.pop();
    return count;
}

/*
Throw a LoopError if there is a loop.
live_nodes is a list of all live (ie not bypassed) nodes in the graph
links_added is a list of the UE virtuals links 
*/
function node_in_loop(live_nodes, links_added) {
    var nodes_to_check = [];
    const nodes_cleared = new Set();
    live_nodes.forEach((n)=>nodes_to_check.push(get_real_node(n.id).id));
    var count = 0;
    while (nodes_to_check.length>0) {
        const node_id = nodes_to_check.pop();
        count += recursive_follow(node_id, node_id, links_added, [], nodes_cleared, [], 0, -1);
        nodes_to_check = nodes_to_check.filter((nid)=>!nodes_cleared.has(nid.toString()));
    }
    console.log(`node_in_loop made ${count} checks`)
}

/*
Is a node alive (ie not bypassed or set to never)
*/
function node_is_live(node){
    if (!node) return false;
    if (node.mode===0) return true;
    if (node.mode===2 || node.mode===4) return false;
    Logger.log(Logger.ERROR, `node ${node.id} has mode ${node.mode} - I only understand modes 0, 2 and 4`);
    return true;
}

function node_is_bypassed(node) {
    return (node.mode===4);
}

/*
Given a link object, and the type of the link,
go upstream, following links with the same type, until you find a parent node which isn't bypassed.
If either type or original link is null, or if the upstream thread ends, return null
*/
function handle_bypass(original_link, type) {
    if (!type || !original_link) return null;
    var link = original_link;
    var parent = get_real_node(link.origin_id);
    if (!parent) return null;
    while (node_is_bypassed(parent)) {
        if (!parent.inputs) return null;
        var link_id;
        if (parent?.inputs[link.origin_slot]?.type == type) link_id = parent.inputs[link.origin_slot].link; // try matching number first
        else link_id = parent.inputs.find((input)=>input.type==type)?.link;
        if (!link_id) { return null; }
        link = app.graph.links[link_id];
        parent = get_real_node(link.origin_id);
    }
    return link;
}

function all_group_nodes() {
    return app.graph._nodes.filter((node) => GroupNodeHandler.isGroupNode(node));
}

function is_in_group(node_id, group_node) {
    return group_node.getInnerNodes().find((inner_node) => (inner_node.id==node_id));
}

/*
Return the group node if this node_id is part of a group, else return the node itself.
Returns a full node object
*/
function get_group_node(node_id, level=Logger.ERROR) {
    const nid = node_id.toString();
    var gn = app.graph._nodes_by_id[nid];
    if (!gn && nid.includes(':')) gn = app.graph._nodes_by_id[nid.split(':')[0]];
    if (!gn) gn = all_group_nodes().find((group_node) => is_in_group(nid, group_node));
    if (!gn) Logger.log(level, `get_group node couldn't find ${nid}`)
    return gn;
}

/*
Return the node object for this node_id. 
- if it's in _nodes_by_id return it
- if it is of the form x:y find it in group node x
- if it is the real node number of something in a group, get it from the group
*/
function get_real_node(node_id, level=Logger.INFORMATION) {
    const nid = node_id.toString();
    var rn = app.graph._nodes_by_id[nid];
    if (!rn && nid.includes(':')) rn = app.graph._nodes_by_id[nid.split(':')[0]]?.getInnerNodes()[nid.split(':')[1]]
    if (!rn) {
        all_group_nodes().forEach((node) => {
            if (!rn) rn = node.getInnerNodes().find((inner_node) => (inner_node.id==nid));
        })
    }
    if (!rn) Logger.log(level, `get_real_node couldn't find ${node_id} - ok during loading, shortly after node deletion etc.`)
    return rn;
}

function get_all_nodes_within(node_id) {
    const node = get_group_node(node_id);
    if (GroupNodeHandler.isGroupNode(node)) return node.getInnerNodes();
    return [];
}


/*
Does this input connect upstream to a live node?
*/
function is_connected(input) {
    const link_id = input.link;
    if (link_id === null) return false;                                    // no connection
    var the_link = app.graph.links[link_id];
    if (!the_link) return false; 
    the_link = handle_bypass(the_link, the_link.type);                       // find the link upstream of bypasses
    if (!the_link) return false;                                           // no source for data.
    return true;
}

/*
Is this a UE node?
*/
function is_UEnode(node_or_nodeType) {
    const title = node_or_nodeType.type ?? node_or_nodeType.comfyClass;
    return ((title) && (title.startsWith("Anything Everywhere") || title==="Seed Everywhere" || title==="Prompts Everywhere"))
}
function is_helper(node_or_nodeType) {
    const title = node_or_nodeType.type ?? node_or_nodeType.comfyClass;
    return ((title) && (title.startsWith("Simple String")))
}
function has_priority_boost(node_or_nodeType) {
    const title = node_or_nodeType.type ?? node_or_nodeType.comfyClass;
    return ((title) && (title == "Anything Everywhere?"))   
}

/*
Inject a call into a method on object with name methodname.
The injection is added at the end of the existing method (if the method didn't exist, it is created)
injectionthis and injectionarguments are passed into the apply call (as the this and the arguments)
*/
function inject(object, methodname, tracetext, injection, injectionthis, injectionarguments) {
    const original = object[methodname];
    object[methodname] = function() {
        Logger.trace(`${tracetext} hijack`, arguments);
        original?.apply(this, arguments);
        injection.apply(injectionthis, injectionarguments);
    }
}


export { node_in_loop, handle_bypass, node_is_live, is_connected, is_UEnode, is_helper, inject, Logger, get_real_node, get_group_node, get_all_nodes_within, has_priority_boost}