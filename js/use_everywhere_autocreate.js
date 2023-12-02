import { app } from "../../scripts/app.js";

function autoCreateMenu(opts) {
    //opts.e.stopPropagation();
    var options = ["Search",];
    var search_opts;
    if (opts.nodeFrom && opts.slotFrom) {
        options.push(null);
        options.push("Anything Everywhere");
        options.push("Anything Everywhere?");
        if (opts.nodeFrom?.outputs?.length==3 && 
            opts.nodeFrom.outputs[0].name=='MODEL' && 
            opts.nodeFrom.outputs[1].name=='CLIP' && 
            opts.nodeFrom.outputs[2].name=='VAE') options.push("Anything Everywhere3");
        search_opts = {node_from: opts.nodeFrom, slot_from: opts.slotFrom, type_filter_in: opts.slotFrom.type};
    } else {
        search_opts = {node_to: opts.nodeTo, slot_from: opts.slotTo, type_filter_out: slotTo.type};
    }

    var menu = new LiteGraph.ContextMenu(options, {
        event: opts.e,
        title: "UE Node",
        callback: inner_clicked
    });

    const p = [	opts.e.canvasX, opts.e.canvasY ];

    function inner_clicked(v,options,e) {
        if (!v) return;
        if (v=="Search") {
            app.canvas.showSearchBox(opts.e,search_opts);
            return;
        }
        var newNode = LiteGraph.createNode(v);
        app.graph.add(newNode);
        newNode.pos = p; 
        if (v=="Anything Everywhere3") {
            for (var i=0; i<3; i++) {opts.nodeFrom.connect( i, newNode, i );}
        } else {
            opts.nodeFrom.connect( opts.nodeFrom.findOutputSlot(opts.slotFrom.name), newNode, 0 );
        }
        app.graph.change();
    }
}

export {autoCreateMenu}