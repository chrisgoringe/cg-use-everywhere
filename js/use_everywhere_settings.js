import { app } from "../../scripts/app.js";
import { GraphAnalyser } from "./use_everywhere_graph_analysis.js";
import { LinkRenderController } from "./use_everywhere_ui.js";
import { convert_to_links, remove_all_ues } from "./use_everywhere_apply.js";
import { has_priority_boost } from "./use_everywhere_utilities.js";
import { settingsCache } from "./use_everywhere_cache.js";

export const SETTINGS = [
    {
        id: "Use Everywhere.About",
        name: "Version 6.1",
        type: () => {return document.createElement('span')},
    },  
    {
        id: "Use Everywhere.Graphics.showlinks",
        name: "Show links",
        type: "combo",
        options: [ {value:0, text:"All off"}, {value:1, text:"Selected nodes"}, {value:2, text:"Mouseover node"}, {value:3, text:"Selected and mouseover nodes"}, {value:4, text:"All on"}],
        defaultValue: 3,
        onChange: settingsCache.onSettingChangeChange,
    },      
    {
        id: "Use Everywhere.Graphics.fuzzlinks",
        name: "Statically distinguish UE links",
        type: "boolean",
        tooltip: "Render UE links, when shown, differently from normal links. Much lower performance cost than animation.",
        defaultValue: true,
        onChange: settingsCache.onSettingChangeChange,
    },  
    {
        id: "Use Everywhere.Graphics.animate",
        name: "Animate UE links",
        type: "combo",
        options: [ {value:0, text:"Off"}, {value:1, text:"Dots"}, {value:2, text:"Pulse"}, {value:3, text:"Both"}, ],
        defaultValue: 0,
        onChange: settingsCache.onSettingChangeChange,
        tooltip: "Animating links may have a negative impact on UI performance. Consider using Statically distinguish UE links instead."
    },
    {
        id: "Use Everywhere.Graphics.stop_animation_when_running",
        name: "Turn animation off when workflow is running",
        type: "boolean",
        defaultValue: true,
        onChange: settingsCache.onSettingChangeChange,
    },    
    {
        id: "Use Everywhere.Graphics.highlight",
        name: "Highlight connected and connectable inputs",
        type: "boolean",
        defaultValue: true,
        onChange: settingsCache.onSettingChangeChange,
    },
    {
        id: "Use Everywhere.Options.connect_to_bypassed",
        name: "Connect to bypassed nodes",
        type: "boolean",
        defaultValue: false,
        onChange: settingsCache.onSettingChange,
        tooltip: "By default UE links are made to the node downstream of bypassed nodes."
    },
    {
        id: "Use Everywhere.Options.checkloops",
        name: "Check for loops before submitting",
        type: "boolean",
        defaultValue: true,
        onChange: settingsCache.onSettingChange,
        tooltip: "Check to see if UE links have created a loop that wasn't there before"
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
]



function submenu(properties, property, options, e, menu, node) {
    const current = properties[property] ? (properties[property]==2 ? 3 : 2 ) : 1; 
    const submenu = new LiteGraph.ContextMenu(
        options,
        { event: e, callback: inner_function, parentMenu: menu, node: node }
    );
    const current_element = submenu.root.querySelector(`:nth-child(${current})`);
    if (current_element) current_element.style.borderLeft = "2px solid #484";
    function inner_function(v) {
        if (node) {
            const choice = Object.values(options).indexOf(v);
            properties[property] = choice;
            LinkRenderController.instance().mark_link_list_outdated();
        }
    }
}

const GROUP_RESTRICTION_OPTIONS = ["No restrictions", "Send only within group", "Send only not within group"]
function group_restriction_submenu(value, options, e, menu, node) {
    submenu(node.properties, "group_restricted", GROUP_RESTRICTION_OPTIONS, e, menu, node);
}

const COLOR_RESTRICTION_OPTIONS = ["No restrictions", "Send only to same color", "Send only to different color"]
function color_restriction_submenu(value, options, e, menu, node) {
    submenu(node.properties, "color_restricted", COLOR_RESTRICTION_OPTIONS, e, menu, node);
}

function priority_boost_submenu(value, options, e, menu, node) {
    const current = (node.properties["priority_boost"] ? node.properties["priority_boost"] : 0) + 1;
    const submenu = new LiteGraph.ContextMenu(
        [0,1,2,3,4,5,6,7,8,9],
        { event: e, callback: function (v) { 
            node.properties["priority_boost"] = parseInt(v);
            LinkRenderController.instance().mark_link_list_outdated();
        }, 
        parentMenu: menu, node:node}
    )
    const current_element = submenu.root.querySelector(`:nth-child(${current})`);
    if (current_element) current_element.style.borderLeft = "2px solid #484";
}

function highlight_selected(submenu_root, node, names) {
    names.forEach((name, i) => {
        const current_element = submenu_root?.querySelector(`:nth-child(${i+1})`);
        if (current_element) {
            if (node.properties['widget_ue_connectable'][name]) {
                current_element.style.borderLeft = "2px solid #484";
            } else {
                current_element.style.borderLeft = "";
            }
        } else {
            let a;
        }
    })
}

function widget_ue_submenu(value, options, e, menu, node) {
    if (!(node.properties['widget_ue_connectable'])) node.properties['widget_ue_connectable'] = {};
    
    const linkedWidgets = new Set()
    node.widgets
        .filter(w => w.linkedWidgets)
        .forEach((widget) => { widget.linkedWidgets.forEach((lw)=>{linkedWidgets.add(lw)}) });

    const names = []
    node.widgets
        .filter(w => !linkedWidgets.has(w))
        .filter(w => !w.hidden)
        .filter(w => !w.name?.includes('$$'))
        .forEach((widget) => { names.push(widget.name) });

    const submenu = new LiteGraph.ContextMenu(
        names,
        { event: e, callback: function (v) { 
            node.properties['widget_ue_connectable'][v] = !!!node.properties['widget_ue_connectable'][v]; 
            LinkRenderController.instance().mark_link_list_outdated();
            highlight_selected(this.parentElement, node, names)
            return true; // keep open
        },
        parentMenu: menu, node:node}
    )
    highlight_selected(submenu.root, node, names)
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
                content: "UE Connectable Widgets",
                has_submenu: true,
                callback: widget_ue_submenu,
            }            
        )
    }
    options.push(null);
}

export function node_menu_settings(options, node) {
    options.push(null);
    if (has_priority_boost(node)) options.push(
        {
            content: "Priority Boost",
            has_submenu: true,
            callback: priority_boost_submenu,
        }
    )
    options.push(
        {
            content: "Group Restrictions",
            has_submenu: true,
            callback: group_restriction_submenu,
        }, 
        {
            content: "Color Restrictions",
            has_submenu: true,
            callback: color_restriction_submenu,
        },
        {
            content: "Convert to real links",
            callback: async () => {
                const ues = GraphAnalyser.instance().analyse_graph(true);
                convert_to_links(ues, node.id);
                app.graph.remove(node);
            }
        }
    )
    options.push(null);
}

export function canvas_menu_settings(options) {
    options.push(null); // divider
    options.push({
        content: (app.ui.settings.getSettingValue('Use Everywhere.Graphics.showlinks')>0) ? "Hide UE links" : "Show UE links",
        callback: () => {
            const setTo = (app.ui.settings.getSettingValue('Use Everywhere.Graphics.showlinks')>0) ? 0 : 4;
            app.ui.settings.setSettingValue('Use Everywhere.Graphics.showlinks', setTo);
            app.graph.change();
        }
    },
    {
        content: "Convert all UEs to real links",
        callback: async () => {
            if (window.confirm("This will convert all links created by Use Everywhere to real links, and delete all the Use Everywhere nodes. Is that what you want?")) {
                const ues = GraphAnalyser.instance().analyse_graph(true);
                LinkRenderController.instance().pause("convert");
                try {
                    convert_to_links(ues, -1);
                    remove_all_ues(true);
                } finally {
                    app.graph.change();
                    LinkRenderController.instance().unpause()
                }
                
            }
        }
    });
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

