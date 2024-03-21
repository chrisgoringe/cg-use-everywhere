import { nodes_in_my_group, nodes_not_in_my_group, nodes_my_color, nodes_not_my_color, nodes_in_groups_matching } from "./use_everywhere_ui.js";
import { Logger, node_is_live, get_real_node } from "./use_everywhere_utilities.js";

function display_name(node) { 
    if (node?.title) return node.title;
    if (node?.type) return node.type;
    if (node?.properties['Node name for S&R']) return node.properties['Node name for S&R'];
    return "un-nameable node";
}

/*
The UseEverywhere object represents a single 'broadcast'. It generally contains
    controller                  - the UE node that controls the broadcase
    control_node_input_index    - the input on that node 
    type                        - the data type
    output                      - the output that is being rebroadcast as a list (node_id, output_index)
    title_regex, input_regex    - the UE? matching rules
    priority                    - priorty :)
*/
class UseEverywhere {
    constructor() {
        this.sending_to = [];
        Object.assign(this, arguments[0]);
        if (this.priority === undefined) this.priority = 0;
        this.description = `source ${this?.output[0]}.${this?.output[1]} -> control ${this?.controller.id}.${this?.control_node_input_index} "${this.type}" <-  (priority ${this.priority})`;
        if (this.title_regex) this.description += ` - node title regex '${this.title_regex.source}'`;
        if (this.input_regex) this.description += ` - input name regex '${this.input_regex.source}'`;
    }

    sending_differs_from(another_ue) {
        if (this.sending_to.length != another_ue.sending_to.length) return true;
        for (var i=0; i<this.sending_to.length; i++) {
            if ( (this.sending_to[i].node != another_ue.sending_to[i].node) ||
                 (this.sending_to[i].input != another_ue.sending_to[i].input) ||
                 (this.sending_to[i].input_index != another_ue.sending_to[i].input_index) ) return true;
        }
        return false;
    }
    /*
    Does this broadcast match a given node,input?
    */
    matches(node, input) {
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
    if (!node_is_live(params.controller)) return `UE node ${params.output[0]} is not alive`;
    if (!node_is_live(get_real_node(params.output[0]))) return `upstream node ${params.output[0]} is not alive`;
    return "";
}

class UseEverywhereList {
    constructor() { this.ues = []; this.unmatched_inputs = []; }

    differs_from(another_uel) {
        if (!another_uel) return true;
        if (this.ues.length != another_uel.ues.length) return true;
        for (var i=0; i<this.ues.length; i++) {
            if (this.ues[i].sending_differs_from(another_uel.ues[i])) return true;
        }
        return false;
    }

    add_ue(node, control_node_input_index, type, output, title_regex, input_regex, group_regex, priority) {
        const params = {
            controller: node,
            control_node_input_index: control_node_input_index, 
            type: type,
            output: output,
            title_regex: title_regex,
            input_regex: input_regex,
            group_regex: group_regex,
            priority: priority
        };
        const real_node = get_real_node(node.id);
        if (!real_node) {
            Logger.log(Logger.PROBLEM, `Node ${node.id} not found`, params);
            return;
        }
        if (real_node.properties.group_restricted == 1) {
            params.restrict_to = nodes_in_my_group(node.id);
            params.priority += 0.1;
        }
        if (real_node.properties.group_restricted == 2) {
            params.restrict_to = nodes_not_in_my_group(node.id);
            params.priority += 0.1;
        }
        if (real_node.properties.color_restricted == 1) {
            params.restrict_to = nodes_my_color(node.id, params.restrict_to);
            params.priority += 0.3;
        }
        if (real_node.properties.color_restricted == 2) {
            params.restrict_to = nodes_not_my_color(node.id, params.restrict_to);
            params.priority += 0.3;
        }
        if (group_regex) {
            params.restrict_to = nodes_in_groups_matching(group_regex, params.restrict_to);
        }
        if (real_node.properties["priority_boost"]) params.priority += real_node.properties["priority_boost"];
        
        const ue = new UseEverywhere(params);
        const error = validity_errors(params);
        if (error==="") { 
            this.ues.push(ue);
            Logger.log(Logger.INFORMATION, `Added ${ue.description}`)
        } else {
            Logger.log(Logger.PROBLEM, `Rejected ${ue.description} because ${error}`, params);
        }
    }

    find_best_match(node, input, _ambiguity_messages) {
        this.unmatched_inputs.push({"node":node, "input":input});
        var matches = this.ues.filter((candidate) => (  
            candidate.matches(node, input)
        ));
        if (matches.length==0) {
            Logger.log(Logger.INFORMATION, `'${display_name(node)}' optional input '${input.name}' unmatched`)
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
        Logger.log(Logger.INFORMATION,`'${display_name(node)}' input '${input.name}' matched to ${matches[0].description}`);
        return matches[0];        
    }

    print_all() {
        this.ues.forEach((ue) => { console.log(ue.describe()); });
    }

    all_unmatched_inputs(type) {
        return this.unmatched_inputs.filter((ui)=>ui.input.type==type);
    }

    all_nodes_with_unmatched_input(type) {
        const result = new Set();
        this.all_unmatched_inputs(type).forEach((ui) => {
            result.add(display_name(ui.node));
        })
        return result;
    }

    all_unmatched_input_names(type) {
        const result = new Set();
        this.all_unmatched_inputs(type).forEach((ui) => {
            result.add(ui.input.label ? ui.input.label : ui.input.name);
        })
        return result;
    }

    all_group_names() {
        const result = new Set();
        app.graph._groups.forEach((group) => {
            result.add(group.title);
        })
        return result;
    }

    all_connected_inputs(for_node) {
        const ue_connections = [];
        this.ues.forEach((ue) => { 
            ue.sending_to.forEach((st) => {
                if (st.node.id == for_node.id) {
                    ue_connections.push({
                        type : ue.type, 
                        input_index : st.input_index,
                        control_node : get_real_node(ue.controller.id),
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
                    control_node : get_real_node(ue.controller.id),
                    control_node_input_index : ue.control_node_input_index,
                    sending_to : st.node,
                });
            });
        });
        return ue_connections;        
    }

    all_ue_connections_for(node_id) {
        const ue_connections = [];
        this.ues.forEach((ue) => { 
            ue.sending_to.forEach((st) => {
                if (get_real_node(st.node.id).id==node_id || get_real_node(ue.controller.id).id==node_id) {
                    ue_connections.push({
                        type : ue.type, 
                        input_index : st.input_index,
                        control_node : get_real_node(ue.controller.id),
                        control_node_input_index : ue.control_node_input_index,
                        sending_to : st.node,
                    });
                }
            });
        });
        return ue_connections;   
    }
}

export {UseEverywhereList}