function mode_is_live(mode){
    if (mode===0) return true;
    if (mode===2 || mode===4) return false;
    console.log("Found node with mode which isn't 0, 2 or 4... confused by treating it as active");
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
    return mode_is_live(source_node.mode);                                 // is the upstream node alive?
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
0 - nothing
1 - single lines mostly
2 - ue list when reloaded
3 - lots of stuff
*/
const DEBUG_LEVEL = 3;

export {mode_is_live, is_connected, is_UEnode, DEBUG_LEVEL}