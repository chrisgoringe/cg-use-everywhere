class Logger {
    static ERROR       = 0; // actual errors
    static PROBLEM     = 1; // things that stop the workflow working
    static INFORMATION = 2; // record of good things
    static DETAIL      = 3; // details

    static LEVEL = Logger.PROBLEM;
    static TRACE = false;   // most of the method calls

    static log(level, message, array) {
        if (level <= Logger.LEVEL) {
            console.log(message);
            if (array) for (var i=0; i<array.length; i++) { console.log(array[i]) }
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

function recursive_follow(node_id, start_node_id, links_added, stack, nodes_seen, ues, count) {
    count += 1;
    if (stack.includes(node_id)) throw new LoopError(node_id, new Set(stack), new Set(ues));
    stack.push(node_id.toString());
    nodes_seen.add(node_id);
    const node = app.graph._nodes_by_id[node_id];
    node?.inputs?.forEach((input) => {
        const link_id = input.link;
        if (link_id) {
            const link = app.graph.links[link_id];
            if (link) recursive_follow(link.origin_id, start_node_id, links_added, stack, nodes_seen, ues, count);
        }
    });
    links_added.forEach((la)=>{
        if (la.downstream==node_id) {
            ues.push(la.controller.toString());
            recursive_follow(la.upstream, start_node_id, links_added, stack, nodes_seen, ues, count);
            ues.pop();
        }
    });
    stack.pop();
}

/*
Throw a LoopError if there is a loop
*/
function node_in_loop(live_nodes, links_added) {
    var nodes_to_check = [];
    live_nodes.forEach((n)=>nodes_to_check.push(n.id));
    while (nodes_to_check.length>0) {
        const node_id = nodes_to_check.pop();
        const nodes_seen = new Set();
        var count = 0;
        recursive_follow(node_id, node_id, links_added, [], nodes_seen, [], count);
        nodes_to_check = nodes_to_check.filter((nid)=>!nodes_seen.has(nid));
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
    var parent = app.graph._nodes_by_id[link.origin_id];
    if (!parent) return null;
    while (node_is_bypassed(parent)) {
        var link_id;
        if (parent?.inputs[link.origin_slot]?.type == type) link_id = parent.inputs[link.origin_slot].link; // try matching number first
        else link_id = parent.inputs.find((input)=>input.type==type)?.link;
        if (!link_id) { return null; }
        link = app.graph.links[link_id];
        parent = app.graph._nodes_by_id[link.origin_id];
    }
    return link;
}

/*
Does this input connect upstream to a live node?
*/
function is_connected(input) {
    const link_id = input.link;
    if (link_id === null) return false;                                    // no connection
    var the_link = app.graph.links[link_id];            
    the_link = handle_bypass(the_link, the_link.type);                       // find the link upstream of bypasses
    if (!the_link) return false;                                           // no source for data.
    return true;
}

/*
Is this a UE node?
*/
function is_UEnode(node_or_nodeType) {
    var title = node_or_nodeType.type;
    if (title===undefined) title = node_or_nodeType.comfyClass;
    if (title===undefined) return false;
    return (title.startsWith("Anything Everywhere") || title==="Seed Everywhere" || title==="Prompts Everywhere")
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


export { node_in_loop, handle_bypass, node_is_live, is_connected, is_UEnode, inject, Logger}