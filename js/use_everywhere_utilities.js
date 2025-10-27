import { app } from "../../scripts/app.js";
import { settingsCache } from "./use_everywhere_cache.js";
import { link_is_from_subgraph_input, visible_graph, wrap_input } from "./use_everywhere_subgraph_utils.js";
import { i18n } from "./i18n.js";
import { ue_callbacks } from "./recursive_callbacks.js";

export function create( tag, clss, parent, properties ) {
    const nd = document.createElement(tag);
    if (clss)       clss.split(" ").forEach((s) => nd.classList.add(s))
    if (parent)     parent.appendChild(nd);
    if (properties) Object.assign(nd, properties);
    return nd;
}

/*
Return  1 if x is  a   later version than y (or y is not defined)
Return -1 if x is an earlier version than y (or x is not defined)
Return  0 if they are the same version 
*/
function version_compare(x,y) {
    if (x==y) return  0
    if (!y)   return  1
    if (!x)   return -1
    const xbits = x.split('.')
    const ybits = y.split('.')
    var result = 0
    for (var i=0; result!=0 && i<Math.min(xbits.length, ybits.length); i++) {
        if (parseInt(xbits[i]) < parseInt(ybits[i])) result = -1
        if (parseInt(xbits[i]) > parseInt(ybits[i])) result = 1
    }
    if (result==0) {
        if (xbits.length < ybits.length) result = -1
        if (xbits.length > ybits.length) result = 1
    }
    return result
}

export function version_at_least(x,y) {
    return (version_compare(x,y) >= 0)
}

/*
Return the node object for this node_id. 
*/
export function get_real_node(node_id, graph) {
    if (!graph) graph = visible_graph()
    const nid = node_id.toString();
    if (nid==-10) return wrap_input(graph.inputNode); // special case for subgraph input
    return graph._nodes_by_id[nid];
}

export class Logger {
    static LIMITED_LOG_BLOCKED = false;
    static LIMITED_LOG_MS      = 5000;
    static level;  // 0 for errors only, 1 activates 'log_problem', 2 activates 'log_info', 3 activates 'log_detail'

    static log_error(message, more) { 
        if (more) console.log(more)
        console.error(message)
    }

    static log(message, foreachable, limited) {
        if (limited && Logger.check_limited()) return false
        console.log(message);
        foreachable?.forEach((x)=>{console.log(x)})
        return true
    }

    static log_with_trace() { 
        if (Logger.log(arguments)) console.trace()
    }

    static check_limited() {
        if (Logger.LIMITED_LOG_BLOCKED) return true
        Logger.LIMITED_LOG_BLOCKED = true
        setTimeout( ()=>{Logger.LIMITED_LOG_BLOCKED = false}, Logger.LIMITED_LOG_MS )
        return false
    }

    static null() {}

    static level_changed(new_level) {
        Logger.level = new_level    
        Logger.log_detail  = (Logger.level>=3) ? Logger.log : Logger.null
        Logger.log_info    = (Logger.level>=2) ? Logger.log : Logger.null
        Logger.log_problem = (Logger.level>=1) ? Logger.log_with_trace : Logger.null
    }

    static log_detail(){}
    static log_info(){}
    static log_problem(){}
}

Logger.level_changed(settingsCache.getSettingValue('Use Everywhere.Options.logging'))
settingsCache.addCallback('Use Everywhere.Options.logging', Logger.level_changed)

class GraphConverter {
    static _instance;
    static instance() {
        if (!GraphConverter._instance) GraphConverter._instance = new GraphConverter();
        return GraphConverter._instance;
    }

    constructor() { 
        this.node_input_map = {};
        this.given_message = false;
        this.did_conversion = false;
     }

    running_116_plus() {
        const version = __COMFYUI_FRONTEND_VERSION__.split('.')
        return (parseInt(version[0])>=1 && (parseInt(version[0])>1 || parseInt(version[1])>=16))
    }

    store_node_input_map(data) { 
        this.node_input_map = {};
        data?.nodes.filter((node)=>(node.inputs)).forEach((node) => { this.node_input_map[node.id] = node.inputs.map((input) => input.name); })
        Logger.log_detail("stored node_input_map", this.node_input_map);
    }


    clean_ue_node(node) {
        var expected_inputs = 1
        if (node.type == "Seed Everywhere") expected_inputs = 0
        if (node.type == "Prompts Everywhere") expected_inputs = 2
        if (node.type == "Anything Everywhere3") expected_inputs = 3
        if (node.type == "Anything Everywhere?") expected_inputs = 4

        // remove all the 'anything' inputs (because they may be duplicated)
        const removed = node.inputs.filter(i=>(i.label==i18n('anything') || i.label=='*'))
        node.inputs   = node.inputs.filter(i=>(i.label!=i18n('anything') && i.label!='*')) 
        // add them back as required
        while (node.inputs.length < expected_inputs) { node.inputs.push(removed.pop()) }
        // the input comes before the regex widgets in UE?
        if (expected_inputs==4) {
            while(node.inputs[0].name.includes('regex')) {
                node.inputs.unshift(node.inputs.pop()) 
            }
        }
        // fix the localized names
        node.inputs = node.inputs.forEach((input) => {
            if (input) {
                if (!input.localized_name || input.localized_name.startsWith(i18n('anything'))) input.localized_name = input.name
            } else {
                let brteakpoint;
            }
        })

        // set types to match
        if (node.inputs) {
            node.inputs.forEach((input) => {
                if (input.type=='*') {
                    const graph = node.graph;
                    if (input.link) {
                        const llink = graph.links[input.link];
                        if (link_is_from_subgraph_input(llink)) {
                            input.type = get_subgraph_input_type(graph, llink.origin_slot);
                        } else {
                            input.type = llink.type;
                        }
                    } else {
                        input.type = (input.label && input.label!=i18n('anything')) ? input.label : input.name
                    }
                }
            });

            Logger.log_detail(`clean_ue_node ${node.id} (${node.type})`, node.inputs);
        }
    }

    convert_if_pre_116(node) {
        if (!node) return;

        if (node.properties?.ue_properties?.widget_ue_connectable) return
        if (node.properties?.widget_ue_connectable) return  // pre 7.0 node which will be converted

        if (is_UEnode(node, false)) {
            if (node.properties?.ue_properties?.version) return
            this.clean_ue_node(node)
        }

        if (!this.given_message) {
            Logger.log_info(`Graph was saved with a version of ComfyUI before 1.16, so Anything Everywhere will try to work out which widgets are connectable`);
            this.given_message = true;
        }

        if (!node.properties.ue_properties) node.properties.ue_properties = {}
        node.properties.ue_properties['widget_ue_connectable'] = {}
        const widget_names = node.widgets?.map(w => w.name) || [];

        if (!(this.node_input_map[node.id])) {
            Logger.log_detail(`node ${node.id} (${node.type} has no node_input_map`);
        } else {
            this.node_input_map[node.id].filter((input_name)=>widget_names.includes(input_name)).forEach((input_name) => {
                node.properties.ue_properties['widget_ue_connectable'][input_name] = true;
                this.did_conversion = true;
                Logger.log_info(`node ${node.id} widget ${input_name} marked as accepting UE because it was an input when saved`);
            });
        }
    }

    remove_saved_ue_links(graph) {
        if (graph.extra?.links_added_by_ue) {
            graph.extra.links_added_by_ue.forEach((link_id) => { app.graph.links.delete(link_id); })
        }
    }
}

export const graphConverter = GraphConverter.instance();
ue_callbacks.register_allgraph_callback('afterConfigureGraph', graphConverter.remove_saved_ue_links)

/*
Is a node alive (ie not bypassed or set to never)
*/
export function node_is_live(node, treat_bypassed_as_live){
    if (!node) return false;
    if (node.mode===0) return true;
    if (node.mode===2 || node.mode===4) return !!treat_bypassed_as_live;
    Logger.log_error(`node ${node.id} has mode ${node.mode} - I only understand modes 0, 2 and 4`);
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
function handle_bypass(original_link, type, graph) {
    if (!type || !original_link) return null;
    var link = original_link;
    if (link_is_from_subgraph_input(link)) return link
    var parent = get_real_node(link.origin_id, graph);
    if (!parent) return null;
    while (node_is_bypassed(parent)) {
        if (!parent.inputs) return null;
        var link_id;
        if (parent?.inputs[link.origin_slot]?.type == type) link_id = parent.inputs[link.origin_slot].link; // try matching number first
        else link_id = parent.inputs.find((input)=>input.type==type)?.link;
        if (!link_id) { return null; }
        link = graph.links[link_id];
        parent = get_real_node(link.origin_id, graph);
    }
    return link;
}


/*
Does this input connect upstream to a live node?
*/
export function is_connected(input, treat_bypassed_as_live, graph) {
    const link_id = input.link;
    if (link_id === null) return false;                                    // no connection
    var the_link = graph.links[link_id];
    if (!the_link) return false; 
    if (treat_bypassed_as_live) return true;
    the_link = handle_bypass(the_link, the_link.type, graph);              // find the link upstream of bypasses
    if (!the_link) return false;                                           // no source for data.
    return true;
}

/*
Is this a UE node?
*/
export function is_UEnode(node_or_nodeType, include_converts) {
    if (include_converts && node_or_nodeType.properties?.ue_convert) return true;
    const title = node_or_nodeType.type || node_or_nodeType.comfyClass;
    return ((title) && (title.startsWith("Anything Everywhere") || title==="Seed Everywhere" || title==="Prompts Everywhere"))
}

/*
Inject a call into a method on object with name methodname.
The injection is added at the end of the existing method (if the method didn't exist, it is created)
injectionthis and injectionarguments are passed into the apply call (as the this and the arguments)
*/
export function inject(object, methodname, tracetext, injection, injectionthis, injectionarguments) {
    const original = object[methodname];
    object[methodname] = function() {
        original?.apply(this, arguments);
        injection.apply(injectionthis, injectionarguments);
    }
}

export function defineProperty(instance, property, desc) {
    const existingDesc = Object.getOwnPropertyDescriptor(instance, property);
    if (existingDesc?.configurable === false) {
      throw new Error(`Error: Cannot define un-configurable property "${property}"`);
    }
    if (existingDesc?.get && desc.get) {
      const descGet = desc.get;
      desc.get = () => {
        existingDesc.get.apply(instance, []);
        return descGet.apply(instance, []);
      };
    }
    if (existingDesc?.set && desc.set) {
      const descSet = desc.set;
      desc.set = (v) => {
        existingDesc.set.apply(instance, [v]);
        return descSet.apply(instance, [v]);
      };
    }
    desc.enumerable = desc.enumerable ?? existingDesc?.enumerable ?? true;
    desc.configurable = desc.configurable ?? existingDesc?.configurable ?? true;
    if (!desc.get && !desc.set) {
      desc.writable = desc.writable ?? existingDesc?.writable ?? true;
    }
    return Object.defineProperty(instance, property, desc);
  }

export class Pausable {
    constructor(name) {
        this.name = name
        this.pause_depth = 0
    }
    pause(note, ms) {
        this.pause_depth += 1;
        if (this.pause_depth>10) {
            Logger.log_error(`${this.name} Over pausing`)
        }
        Logger.log_detail(`${this.name} pause ${note} with ${ms}`)
        if (ms) setTimeout( this.unpause.bind(this), ms );
    }
    unpause() { 
        this.pause_depth -= 1
        Logger.log_detail(`${this.name} unpause`)
        if (this.pause_depth<0) {
            Logger.log_error(`${this.name} Over unpausing`)
            this.pause_depth = 0
        }
    this.on_unpause()
    }
    paused() {
        return (this.pause_depth>0)
    }
    on_unpause(){}
}

export function get_connection(node, i) {
    const graph = node.graph
    const in_link = node?.inputs[i]?.link;
    if (in_link) {
        var llink = graph.links[in_link]
        llink = handle_bypass(llink, llink.type, graph)
        if (!llink) {
            Logger.log(`handle_bypass failing - subgraph issue?`, null, true)
            llink = graph.links[in_link]
        }
        return { link:llink, type:llink.type }
    } else {
        return { link:undefined, type:undefined }
    }
}
