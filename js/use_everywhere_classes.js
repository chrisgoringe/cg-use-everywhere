import { nodes_in_my_group, nodes_my_color, nodes_in_groups_matching } from "./use_everywhere_ui.js";
import { Logger, node_is_live } from "./use_everywhere_utilities.js";

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
    if (!node_is_live(app.graph._nodes_by_id[params.output[0]])) return `upstream node ${params.output[0]} is not alive`;
    return "";
}

class UseEverywhereList {
    constructor() { this.ues = []; }

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
        if (!app.graph._nodes_by_id[node.id]) {
            Logger.log(Logger.PROBLEM, `Node ${node.id} not found`, params);
            return;
        }
        if (app.graph._nodes_by_id[node.id].properties.group_restricted) {
            params.restrict_to = nodes_in_my_group(node.id);
            params.priority += 1;
        }
        if (app.graph._nodes_by_id[node.id].properties.color_restricted) {
            params.restrict_to = nodes_my_color(node.id, params.restrict_to);
            params.priority += 1;
        }
        if (group_regex) {
            params.restrict_to = nodes_in_groups_matching(group_regex, params.restrict_to);
        }
        
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
                Logger.log(Logger.PROBLEM, msg);
                _ambiguity_messages.push(msg);
                for (var i=0; i<matches.length; i++) {
                    if (matches[0].priority == matches[i].priority) {
                        const inner_msg = ` - ${matches[i].controller.type} (${matches[i].controller.id}) input ${matches[i].control_node_input_index}`;
                        Logger.log(Logger.PROBLEM, inner_msg);
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

    all_connected_inputs(for_node) {
        const ue_connections = [];
        this.ues.forEach((ue) => { 
            ue.sending_to.forEach((st) => {
                if (st.node.id == for_node.id) {
                    ue_connections.push({
                        type : ue.type, 
                        input_index : st.input_index,
                        control_node : app.graph._nodes_by_id[ue.controller.id],
                        control_node_input_index : ue.control_node_input_index,
                    });
                }
            });
        });
        return ue_connections;
    }
}

export {UseEverywhereList}