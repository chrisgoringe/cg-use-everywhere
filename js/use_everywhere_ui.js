function maybe_remove_text_display(node) {
    if (!app.ui.settings.getSettingValue('AE.details', false)) {
        const w = node.widgets?.findIndex((w) => w.name === "display_text_widget"); // created by cg_custom_nodes
        if (w>=0) {
            node.widgets.splice(w,1);   // remove it
            node.widgets[w].onRemove(); // cleanly
        }
        node.size = node.computeSize(); // shrink the node
        node.setDirtyCanvas(true, true);// mark for redrawing
    }
}

var ue_node_highlights = false;

async function toggle_ue_node_highlights(app, graph_analyser) {
    ue_node_highlights = !ue_node_highlights;
    if (ue_node_highlights) {
        console.log("toggle ue node highlights on");
        const ue_list = await graph_analyser();
        console.log(ue_list);
        ue_list.print_all();
    } else {
        console.log("toggle ue node highlights off");
    }
    
}

export {maybe_remove_text_display, toggle_ue_node_highlights}