import { app } from "../../scripts/app.js";
import { VERSION, version_at_least, is_UEnode, graphConverter } from "./use_everywhere_utilities.js"
import { LinkRenderController } from "./use_everywhere_ui.js";

export function can_regex(node) {
    return (node.type=="Anything Everywhere" || node.type=="Anything Everywhere?")
}

export function edit_regexes(a,b,c,d, node) {
    const names = ['title', 'input', 'group']
    const table = document.createElement('table')
    for (var i=0; i<=2; i++) {
        const name = names[i]
        const row = document.createElement('tr')
        table.appendChild(row)
        const header = document.createElement('th')
        header.innerText = name
        row.appendChild(header)
        const input = document.createElement('input')
        input.value = node.properties.ue_properties[`${name}_regex`] || ''
        input.addEventListener('input', ()=>{
            node.properties.ue_properties[`${name}_regex`] = input.value
            LinkRenderController.instance().mark_link_list_outdated()
            app.canvas.setDirty(true,true)
        })
        row.appendChild(input)
    }
    app.ui.dialog.show(table)
}

/*
Called whenever any node is created (before setup_ue_properties_onload).
Set node.IS_UE and 
*/
export function setup_ue_properties_oncreate(node) {
    node.IS_UE = is_UEnode(node)
    if (node.IS_UE) {
        if (graphConverter.graph_being_configured) {
            /* 
            If the graph is being configured, we are still loading old nodes. 
            These will be fixed in setup_ue_properties_onload
            */
            return;
        } else {
            /* This is a new node being created */
            if (!node.properties) node.properties = {}
            node.properties.ue_properties = {
                    version               : VERSION,
                    group_restricted      : 0,
                    color_restricted      : 0,
                    widget_ue_connectable : {},
                    title_regex           : null,
                    input_regex           : null,
                    group_regex           : null,
                }
        }
    }
}

/*
Convert pre 7.0 node properties when loaded.
Called after .properties has been attached to the node when reloading 
*/
export function setup_ue_properties_onload(node) {
    if (node.IS_UE) {
        if ( version_at_least(node.properties?.ue_properties?.version, "7.0") ) {
            // here we will need to add any code to convert in later version
            node.IS_UE = node.properties.ue_properties.version
        } else {
            // converting a pre 7.0 UE node
            node.properties.ue_properties = {
                version               : VERSION,
                group_restricted      : node.properties.group_restricted,
                color_restricted      : node.properties.color_restricted,
                widget_ue_connectable : node.properties.widget_ue_connectable,
                title_regex           : node.widgets_values?.[0],
                input_regex           : node.widgets_values?.[1],
                group_regex           : node.widgets_values?.[2],
            }
            delete node.properties.group_restricted
            delete node.properties.color_restricted
            delete node.properties.widget_ue_connectable
            
        }
    }
}

export function convert_ueq_nodes(graph) {
    graph.nodes.filter((node)=>(node.type=="Anything Everywhere?")).forEach((node)=>{
        node.widgets.forEach((w)=>{w.hidden=true})
        if (node.title=="Anything Everywhere?") node.title = "Anything Everywhere"
        node.type = "Anything Everywhere"
    })
    graph.nodes.filter((node)=>(node.subgraph)).forEach((node)=>{
        convert_ueq_nodes(node.subgraph)
    })
}
