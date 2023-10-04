class Logger {
    static ERROR       = 0; // actual errors
    static PROBLEM     = 1; // things that stop the workflow working
    static INFORMATION = 2; // record of good things
    static DETAIL      = 3; // details

    static LEVEL = Logger.INFORMATION;
    static TRACE = true;

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

/*
Does this input connect upstream to a live node?
input.link is the link_id; the form of workflow.links is [id, upnode_id, upnode_output, downnode_id, downnode_input, type]
*/
function is_connected(input, workflow) {
    const link_id = input.link;
    if (link_id === null) return false;                                    // no connection
    const the_link = workflow.links.find((link) => link[0] === link_id);   // link[0] is the link_id
    if (!the_link) return false;                                           // shouldn't happen: link with that id doesn't exist.
    const source_node_id = the_link[1];                                    // link[1] is upstream node_id 
    const source_node = workflow.nodes.find((n) => n.id === source_node_id);
    if (!source_node) return false;                                        // shouldn't happen: node with that id doesn't exist
    return node_is_live(source_node);                                      // is the upstream node alive?
}

/*
Is this a UE node?
*/

function is_UEnode(node_or_nodeType) {
    var title = node_or_nodeType.title;
    if (title===undefined) title = node_or_nodeType.type;
    if (title===undefined) title = node_or_nodeType.comfyClass;
    if (title===undefined) return false;
    return (title.startsWith("Anything Everywhere") || title==="Seed Everywhere")
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


export {node_is_live, is_connected, is_UEnode, inject, Logger}