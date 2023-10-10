import { Logger, node_is_live } from "./use_everywhere_utilities.js";

function display_name(node) { 
    if (node?.title) return node.title;
    if (node?.type) return node.type;
    if (node?.properties['Node name for S&R']) return node.properties['Node name for S&R'];
    return "un-nameable node";
}

class UseEverywhere {
    constructor() {
        this.sending_to = [];
        Object.assign(this, arguments[0]);
        if (this.priority === undefined) this.priority = 0;
        this.description = `source ${this?.output[0]}.${this?.output[1]} -> control ${this?.controller.id}.${this?.control_node_input_index} "${this.type}" <-  (priority ${this.priority})`;
        if (this.title_regex) this.description += ` - node title regex '${this.title_regex.source}'`;
        if (this.input_regex) this.description += ` - input name regex '${this.input_regex.source}'`;
    }
    matches(node, input) {
        if (this.type != input.type) return false;
        if (this.input_regex && !this.input_regex.test(input.name)) return false;
        if (this.title_regex) {
            if (!(this.title_regex.test(node.properties['Node name for S&R']) || this.title_regex.test(node?.title))) return false;
        }
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

    add_ue(node, control_node_input_index, type, output, title_regex, input_regex, priority) {
        const params = {
            controller: node,
            control_node_input_index: control_node_input_index, 
            type: type,
            output: output,
            title_regex: title_regex,
            input_regex: input_regex,
            priority: priority
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

    find_best_match(node, input) {
        var matches = this.ues.filter((candidate) => (  
            candidate.matches(node, input)
        ));
        if (matches.length==0) {
            Logger.log(Logger.PROBLEM, `'${display_name(node)}' optional input '${input.name}' unmatched`)
            return undefined; 
        }
        if (matches.length>1) {
            matches.sort((a,b) => b.priority-a.priority);
            if(matches[0].priority == matches[1].priority) {
                Logger.log(Logger.PROBLEM, `Ambiguous matches for '${display_name(node)}' input '${input.name}'`);
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