function node_is_live(node){
    if (node.mode===0) return true;
    if (node.mode===2 || node.mode===4) return false;
    console.log("Found node with mode which isn't 0, 2 or 4... confused");
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

class Logger {
    static ALWAYS     = 0;
    static BASIC      = 1;
    static DETAILS    = 2;
    static EVERYTHING = 3;

    static LEVEL = Logger.DETAILS;
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
            if (array) for (var i=0; i<array.length; i++) { console.log(`  ${i} = ${array[i]}`) }
        }
    }
}

export {node_is_live, is_connected, is_UEnode, Logger}