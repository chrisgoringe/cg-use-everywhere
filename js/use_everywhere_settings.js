import { app } from "../../scripts/app.js";
import { GraphAnalyser } from "./use_everywhere_graph_analysis.js";
import { LinkRenderController } from "./use_everywhere_ui.js";
import { convert_to_links, remove_all_ues } from "./use_everywhere_apply.js";
import { Logger } from "./use_everywhere_utilities.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { visible_graph, master_graph } from "./use_everywhere_subgraph_utils.js";
import { edit_restrictions } from "./ue_properties_editor.js";
import { is_UEnode } from "./use_everywhere_utilities.js";
import { i18ify_settings } from "./i18n.js";
import { VERSION } from "./shared.js";

const _SETTINGS = [
    {
        id: "Use Everywhere.About",
        name: `Version ${VERSION}`,
        type: () => {return document.createElement('span')},
    },  
    {
        id: "Use Everywhere.Graphics.showlinks",
        name: "Show links",
        type: "combo",
        options: [ {value:0, text:"All off"}, {value:1, text:"Selected nodes"}, {value:2, text:"Mouseover node"}, {value:3, text:"Selected and mouseover nodes"}, {value:4, text:"All on"}],
        defaultValue: 3,
        onChange: settingsCache.onSettingChange,
    },      
    {
        id: "Use Everywhere.Graphics.fuzzlinks",
        name: "Statically distinguish UE links",
        type: "boolean",
        tooltip: "Render UE links, when shown, differently from normal links. Much lower performance cost than animation.",
        defaultValue: true,
        onChange: settingsCache.onSettingChange,
    },  
    {
        id: "Use Everywhere.Graphics.animate",
        name: "Animate UE links",
        type: "combo",
        options: [ {value:0, text:"Off"}, {value:1, text:"Dots"}, {value:2, text:"Pulse"}, {value:3, text:"Both"}, ],
        defaultValue: 0,
        onChange: settingsCache.onSettingChange,
        tooltip: "Animating links may have a negative impact on UI performance. Consider using Statically distinguish UE links instead."
    },
    {
        id: "Use Everywhere.Graphics.stop_animation_when_running",
        name: "Turn animation off when workflow is running",
        type: "boolean",
        defaultValue: true,
        onChange: settingsCache.onSettingChange,
    },    
    {
        id: "Use Everywhere.Graphics.highlight",
        name: "Highlight connected and connectable inputs",
        type: "boolean",
        defaultValue: true,
        onChange: settingsCache.onSettingChange,
    },
    {
        id: "Use Everywhere.Graphics.preserve edit window position",
        name: "Save restrictions edit window position",
        type: "boolean",
        defaultValue: false,
        onChange: settingsCache.onSettingChange,
        tooltip: "If off, the edit window appears where the mouse is"
    },
    {
        id: "Use Everywhere.Graphics.tooltips",
        name: "Show restrictions as tooltip",
        type: "boolean",
        defaultValue: true,
        onChange: settingsCache.onSettingChange,
    },
    {
        id: "Use Everywhere.Options.connect_to_bypassed",
        name: "Connect to bypassed nodes",
        type: "boolean",
        defaultValue: true,
        onChange: settingsCache.onSettingChange,
        tooltip: "By default UE links are made to the node downstream of bypassed nodes."
    },
    {
        id: "Use Everywhere.Options.logging",
        name: "Logging",
        type: "combo",
        options: [ {value:0, text:"Errors Only"}, {value:1, text:"Problems"}, {value:2, text:"Information"}, {value:3, text:"Detail"}, ],
        defaultValue: 1,
        onChange: settingsCache.onSettingChange,
    },
    {
        id: "Use Everywhere.Options.block_graph_validation",
        name: "Block workflow validation",
        type: "boolean",
        defaultValue: true,
        tooltip: "Turn off workflow validation (which tends to replace UE links with real ones)",
        onChange: settingsCache.onSettingChange,
    },
    {
        id: "Use Everywhere.Options.use_output_name",
        name: "When connecting, use the output slot's name as the input name",
        type: "boolean",
        defaultValue: false,
        tooltip: "By default the link type is used as the name",
        onChange: settingsCache.onSettingChange,
    },
]

export const SETTINGS = i18ify_settings(_SETTINGS)

const ui_update_settings = [
    "Use Everywhere.Graphics.showlinks",
    "Use Everywhere.Graphics.fuzzlinks",
    "Use Everywhere.Graphics.animate",
    "Use Everywhere.Graphics.stop_animation_when_running",
    "Use Everywhere.Graphics.highlight",
    "Use Everywhere.Language.language",
]
ui_update_settings.forEach((id) => {
    settingsCache.addCallback(id, ()=>{app.graph?.change.bind(app.graph)})
})

function show_connectable(submenu_root, node) {
    node.inputs.forEach((input, i) => {
        const current_element = submenu_root?.querySelector(`:nth-child(${i+1})`);
        if (current_element) current_element.style.borderLeft = (is_connectable(node,input.name)) ? "2px solid #484" : "";
    })
}

export function is_connectable(node, input_name){
    const input = node.inputs.find(i => i.name==input_name);
    if (!input) {
        Logger.log_error(`Can't find input ${label} on node ${node.title}`);
        return false;
    }
    if (input.widget) {
        return !!(node.properties?.ue_properties?.widget_ue_connectable?.[input_name])
    } else {
        return ! (node.properties?.ue_properties?.input_ue_unconnectable?.[input_name])
    }
}

function toggle_connectable(node, input_name){
    const input = node.inputs.find(i => i.name==input_name);
    const p = node.properties.ue_properties
    if (input.widget) {
        p.widget_ue_connectable[input_name]  = !!!p.widget_ue_connectable[input_name];
    } else {
        p.input_ue_unconnectable[input_name] = !!!p.input_ue_unconnectable[input_name];
    }  
}

function widget_ue_submenu(value, options, e, menu, node) {
    if (!(node.properties.ue_properties)) node.properties.ue_properties = {}
    if (!(node.properties.ue_properties.widget_ue_connectable)) node.properties.ue_properties.widget_ue_connectable = {};
    if (!(node.properties.ue_properties.input_ue_unconnectable)) node.properties.ue_properties.input_ue_unconnectable = {};

    const label_to_name = {}
    node.inputs
        .filter(i => !i.hidden)
        .filter(i => !i.name?.includes('$$'))
        .forEach((input) => { label_to_name[input.label || input.name] = input.name });

    const submenu = new LiteGraph.ContextMenu(
        Object.keys(label_to_name),
        { event: e, callback: function (label) { 
            const name = label_to_name[label];
            toggle_connectable(node, name);
            LinkRenderController.instance().mark_link_list_outdated();
            show_connectable(this.parentElement, node)
            return true; // keep open
        },
        parentMenu: menu, node:node}
    )
    show_connectable(submenu.root, node)
}

export function add_extra_menu_items(node_or_node_type, ioio) {
    if (node_or_node_type.ue_extra_menu_items_added) return
    const getExtraMenuOptions = node_or_node_type.getExtraMenuOptions;
    node_or_node_type.getExtraMenuOptions = function(_, options) {
        getExtraMenuOptions?.apply(this, arguments);
        if (is_UEnode(this)) {
            node_menu_settings(options, this);
        } else {
            non_ue_menu_settings(options, this);
        }
        ioio(options,'callback',`menu option on ${this.id}`);
    }
    node_or_node_type.ue_extra_menu_items_added = true
}

export function non_ue_menu_settings(options, node) {
    options.push(null);
    options.push(
        {
            content: node.properties.rejects_ue_links ? "Allow UE Links" : "Reject UE Links",
            has_submenu: false,
            callback: () => { node.properties.rejects_ue_links = !!!node.properties.rejects_ue_links  },
        }
    )
    if (node.widgets?.length) {
        options.push(
            {
                content: "UE Connectable Inputs",
                has_submenu: true,
                callback: widget_ue_submenu,
            }            
        )
    }
    options.push(null);
}

export function node_menu_settings(options, node) {
    options.push(null);
    options.push(
        {
            content: "Edit restrictions",
            callback: edit_restrictions,
        }        
    )
    options.push(
        {
            content: "Convert to real links",
            callback: async () => {
                const ues = GraphAnalyser.instance().wait_to_analyse_visible_graph();
                convert_to_links(ues, node);
                visible_graph().remove(node);
            }
        }
    )
    options.push(null);
}

export function canvas_menu_settings(options) {
    options.push(null); // divider
    options.push(
        {
            content: (app.ui.settings.getSettingValue('Use Everywhere.Graphics.showlinks')>0) ? "Hide UE links" : "Show UE links",
            callback: () => {
                const setTo = (app.ui.settings.getSettingValue('Use Everywhere.Graphics.showlinks')>0) ? 0 : 4;
                app.ui.settings.setSettingValue('Use Everywhere.Graphics.showlinks', setTo);
                app.graph.change();
            }
        },
        {
            content: "Convert all UEs (in this graph/subgraph) to real links",
            callback: async () => {
                if (window.confirm("This will convert all links (in this graph/subgraph) created by Use Everywhere to real links, and delete all the Use Everywhere nodes. Is that what you want?")) {
                    const ues = GraphAnalyser.instance().wait_to_analyse_visible_graph();
                    LinkRenderController.instance().pause("convert");
                    try {
                        convert_to_links(ues, visible_graph());
                        remove_all_ues(true, visible_graph());
                    } finally {
                        app.graph.change();
                        LinkRenderController.instance().unpause()
                    }
                    
                }
            }
        },
        {
            content: "Convert all UEs to real links",
            callback: async () => {
                if (window.confirm("This will convert all links created by Use Everywhere to real links, and delete all the Use Everywhere nodes. Is that what you want?")) {
                    LinkRenderController.instance().pause("convert");
                    try {
                        GraphAnalyser.instance().modify_graphs_recursively(master_graph())
                        remove_all_ues(true, master_graph(), true);
                    } finally {
                        app.graph.change();
                        LinkRenderController.instance().unpause()
                    }
                    
                }
            }
        },
    );
    if (GraphAnalyser.instance().ambiguity_messages.length) {
        options.push({
            content: "Show UE broadcast clashes",
            callback: async () => { 
                alert(GraphAnalyser.instance().ambiguity_messages.join("\n")) 
            }
        })
    }
    options.push(null); // divider
}

