import { i18n_functional } from "./i18n.js";
import { default_priority } from "./ue_properties.js";
import { node_graph, visible_graph } from "./use_everywhere_subgraph_utils.js";
import { nodes_in_my_group, nodes_not_in_my_group, nodes_my_color, nodes_not_my_color, nodes_in_groups_matching } from "./use_everywhere_ui.js";
import { Logger, node_is_live, get_real_node, get_connection } from "./use_everywhere_utilities.js";


export function display_name(node) { 
    if (node?.title) return node.title;
    if (node?.type) return node.type;
    if (node?.properties['Node name for S&R']) return node.properties['Node name for S&R'];
    return "un-nameable node";
}

function regex_for(node, k) {
    try {
        const w0 = node.properties.ue_properties[`${k}_regex`]
        return (w0 && w0!='.*') ? new RegExp(w0) : null;
    } catch (e) {
        return null
    }
}

/*
The UseEverywhere object represents a single 'broadcast'. It generally contains
    controller                  - the UE node that controls the broadcase
    control_node_input_index    - the input on that node 
    type                        - the data type
    output                      - the output that is being rebroadcast as a list (node_id, output_index)
    title_regex, input_regex    - the UE? matching rules
    priority                    - priorty :)
    graph                       - the graph or subgraph
*/
class UseEverywhere {
    constructor() {
        this.sending_to = [];
        Object.assign(this, arguments[0]);
        if (this.priority === undefined) this.priority = 0;
        if (this.graph === undefined) this.graph = visible_graph();

        const from_node = get_real_node(this?.output[0], this.graph);
        const to_node = get_real_node(this?.controller.id, this.graph)
        try {
            if (this.output[0]==-10) {
                this.description = `source subgraph input slot ${this?.output[1]} ` +
                                `-> control "${display_name(to_node)}", ${to_node.inputs[this?.control_node_input_index].name} (${this?.controller.id}.${this?.control_node_input_index}) ` +
                                `"${this.type}" <-  (priority ${this.priority})`;
            }
            else if (this.control_node_input_index>=0) {
                this.description = `source "${display_name(from_node)}", ${from_node.outputs[this?.output[1]].name} (${this?.output[0]}.${this?.output[1]}) ` +
                                `-> control "${display_name(to_node)}", ${to_node.inputs[this?.control_node_input_index].name} (${this?.controller.id}.${this?.control_node_input_index}) ` +
                                `"${this.type}" <-  (priority ${this.priority})`;
            } else {
                this.description = `source "${display_name(from_node)}", ${from_node.outputs[this?.output[1]].name} (${this?.output[0]}.${this?.output[1]}) ` +
                                `"${this.type}" <-  (priority ${this.priority})`;
            }                
        } catch (e) {
            // for breakpointing
            throw e;
        }
        if (this.title_regex) this.description += ` - node title regex '${this.title_regex.source}'`;
        if (this.input_regex) this.description += ` - input name regex '${this.input_regex.source}'`;
    }

    sending_differs_from(another_ue) {
        if (this.sending_to.length != another_ue.sending_to.length) return true;
        for (var i=0; i<this.sending_to.length; i++) {
            if ( (this.sending_to[i].node.id != another_ue.sending_to[i].node.id) ||
                 (this.sending_to[i].input_index != another_ue.sending_to[i].input_index) ) return true;
        }
        return false;
    }
    /*
    Does this broadcast match a given node,input?
    */
    matches(node, input) {
        if (!node) {
            Logger.log_problem(`UseEverywhere.matches called with no node`);
            return false;
        }

        if (this.additional_requirement && !this.additional_requirement(input, node)) return false

        if (this.output[0] == node.id) return false;
        if (this.restrict_to && !this.restrict_to.includes(node.id)) return false;
        const input_label = input.label ? input.label : input.name;
        const node_label = node.title ? node.title : (node.properties['Node name for S&R'] ? node.properties['Node name for S&R'] : node.type);
        if (this.title_regex) {
            if (!(this.title_regex.test(node_label))) return false;
        }
        if (node.type=="Highway" && typeof this.input_regex==='string') { // Highway nodes - broken if there are two matches...
            const input_label_split = input_label.split(':');
            if (input_label_split.length==1) {
                if (input_label==this.input_regex) {
                    input.type = this.type;
                    input.name += `:${this.type}`;
                    return true;
                }
                return false;
            } else {
                if ((input_label_split[0]==this.input_regex) && input_label_split[1]==input.type) return true;
                return false;
            }
        }
        if (this.type != input.type) return false;
        if (this.input_regex && typeof this.input_regex==='string') return false; // input_regex started '+', which targets Highway nodes only
        if (this.input_regex && !this.input_regex.test(input_label)) return false;
        
        return true;
    }
    note_sending_to(node, input) {
        const input_index = node.inputs.findIndex((n) => n.name==input.name);
        this.sending_to.push({node:node, input:input, input_index:input_index})
    }
    describe_sending(){
        var description = "  Linked to:";
        this.sending_to.forEach((st) => description += `\n  -> ${display_name(st.node)}, ${st.input.name}`);
        if (this.sending_to.length===0) description += ' nothing';
        return description;
    }
    describe() {
        return this.description + "\n" + this.describe_sending();
    }
}

function validity_errors(params) {
    if (!node_is_live(params.controller)) return `UE node ${params.controller.id} is not alive`;
    if (params.output[0]!=-10 && !node_is_live(get_real_node(params.output[0], params.graph))) return `upstream node ${params.output[0]} is not alive`;
    return "";
}

export class UseEverywhereList {
    constructor() { this.ues = []; this.unmatched_inputs = []; }

    differs_from(another_uel) {
        if (!another_uel || !another_uel.ues || !this.ues) return true;
        if (this.ues.length != another_uel.ues.length) return true;
        for (var i=0; i<this.ues.length; i++) {
            if (this.ues[i].sending_differs_from(another_uel.ues[i])) return true;
        }
        return false;
    }

    add_ue(node, control_node_input_index, type, output, input_regex_override, additional_requirement) {
        const params = {
            controller: node,
            control_node_input_index: control_node_input_index, 
            type: type,
            output: output,
            title_regex: regex_for(node, 'title'),
            input_regex: input_regex_override || regex_for(node, 'input'),
            group_regex: regex_for(node, 'group'),
            priority: node.properties.ue_properties.priority || default_priority(node), 
            graph: node_graph(node),
            additional_requirement: additional_requirement,
        };

        if (node.properties.ue_properties.group_restricted == 1) params.restrict_to = nodes_in_my_group(node);
        if (node.properties.ue_properties.group_restricted == 2) params.restrict_to = nodes_not_in_my_group(node);

        if (node.properties.ue_properties.color_restricted == 1) params.restrict_to = nodes_my_color(node, params.restrict_to);
        if (node.properties.ue_properties.color_restricted == 2) params.restrict_to = nodes_not_my_color(node, params.restrict_to);

        if (params.group_regex) params.restrict_to = nodes_in_groups_matching(params.group_regex, params.restrict_to, graph);
        
        var error = ""
        var ue = null;
        try {
            ue = new UseEverywhere(params);
            error = validity_errors(params);
        } catch (e) {
            error = `Error creating UseEverywhere object: ${e}`;
        }
        if (error==="") { 
            this.ues.push(ue);
            Logger.log_detail(`Added ${ue.description}`)
        } else {
            Logger.log_problem(`Rejected ${ue?.description} because ${error}`);
        }
    }

    find_best_match(node, input, _ambiguity_messages) {
        this.unmatched_inputs.push({"node":node, "input":input});
        var matches = this.ues.filter((candidate) => (  
            candidate.matches(node, input)
        ));
        if (matches.length==0) {
            Logger.log_detail(`'${display_name(node)}' optional input '${input.name}' unmatched`)
            return undefined; 
        }
        if (matches.length>1) {
            matches.sort((a,b) => b.priority-a.priority);
            if(matches[0].priority == matches[1].priority) {
                const msg = `'${display_name(node)}' (${node.id}) input '${input.name}' matches multiple Use Everwhere sources:`;
                _ambiguity_messages.push(msg);
                for (var i=0; i<matches.length; i++) {
                    if (matches[0].priority == matches[i].priority) {
                        const inner_msg = ` - ${matches[i].controller.type} (${matches[i].controller.id}) input ${matches[i].control_node_input_index}`;
                        _ambiguity_messages.push(inner_msg);
                    }
                }
                return undefined;
            }
        }
        matches[0].note_sending_to(node, input);
        Logger.log_detail(`'${display_name(node)}' input '${input.name}' matched to ${matches[0].description}`);
        return matches[0];        
    }

    all_connected_inputs(for_node) {
        const ue_connections = [];
        this.ues.forEach((ue) => { 
            ue.sending_to.forEach((st) => {
                if (st.node.id == for_node.id) {
                    ue_connections.push({
                        type : ue.type, 
                        input_index : st.input_index,
                        control_node : get_real_node(ue.controller.id, ue.graph),
                        control_node_input_index : ue.control_node_input_index,
                        sending_to : st.node,
                    });
                }
            });
        });
        return ue_connections;
    }

    all_ue_connections() {
        const ue_connections = [];
        this.ues.forEach((ue) => { 
            ue.sending_to.forEach((st) => {
                ue_connections.push({
                    type : ue.type, 
                    input_index : st.input_index,
                    control_node : get_real_node(ue.controller.id, ue.graph),
                    control_node_input_index : ue.control_node_input_index,
                    sending_to : st.node, 
                    graph: ue.graph,
                });
            });
        });
        return ue_connections;        
    }

    add_ue_from_node(node) {
        const input_types = new Set()
        const duplicated_input_types = new Set()
        for (var i=0; i<node.inputs.length; i++) {
            const connection = get_connection(node, i);
            if (connection.link) {
                if (input_types.has(connection.type)) duplicated_input_types.add(connection.type)
                input_types.add(connection.type)
            }
        }
        if (node.properties.ue_properties.seed_inputs) {
            this.add_ue(node, -1, "INT", [node.id.toString(),0], regex_for(node, 'input'));
        } else {
            node.inputs.forEach((input, i) => {
                const connection = get_connection(node, i);
                if (connection.link) {
                    const input_regex = (node.properties.ue_properties.prompt_regexes) ? prompt_regex(node,i) : undefined
                    var additional_requirement = null
                    if (duplicated_input_types.has(connection.type) && !node.properties.ue_properties.prompt_regexes) {
                        const input_name = input.label || input.name
                        const rule = node.properties.ue_properties?.repeated_type_rule || 0
                        if (rule == 0) { // 0 is exact match of input name
                            additional_requirement = (target_input) => { 
                                const target_name = target_input.label || target_input.name
                                return (target_name == input_name) 
                            }
                        }
                        if (rule == 1) { // 1 is match start of input name
                            additional_requirement = (target_input) => { 
                                const target_name = target_input.label || target_input.name
                                const chars = Math.min( input_name.length, target_name.length )
                                return (target_name.substring(0, chars) == input_name.substring(0, chars)) 
                            }
                        }
                        if (rule == 2) { // 2 is match end of input name
                            additional_requirement = (target_input) => { 
                                const target_name = target_input.label || target_input.name
                                const chars = Math.min( input_name.length, target_name.length )
                                return (target_name.substring(target_name.length - chars) == input_name.substring(input_name.length - chars)) 
                            }
                        }
                        if (rule == 3) { // 3 input is match of target node name
                            additional_requirement = (_, target_node) => { 
                                const target_name = target_node.title
                                return (target_name == input_name) 
                            }
                        }
                    }
                    this.add_ue(node, i, connection.type, [connection.link.origin_id.toString(), connection.link.origin_slot], input_regex, additional_requirement);
                }
            })
        }
    }
}

const P_REGEXES = ['prompt', 'negative']
const PROMPT_REGEXES = [new RegExp(i18n_functional('prompt_regex')), new RegExp(i18n_functional('negative_regex'))]

function prompt_regex(node, i) {
    const reg = node.properties.ue_properties[`${P_REGEXES[i]}_regex`]
    if (reg) return new RegExp(reg)
    else return PROMPT_REGEXES[i]
}

