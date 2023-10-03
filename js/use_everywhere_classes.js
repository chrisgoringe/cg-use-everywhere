import { is_UEnode, DEBUG_LEVEL } from "./use_everywhere_utilities.js";

function display_name(node) { return (node?.title) ? node.title : node.properties['Node name for S&R']; }

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
        this.ues.push(ue);
        if (DEBUG_LEVEL>1) console.log(`Added ${ue.description}`)
    }

    find_best_match(node, input) {
        var matches = this.ues.filter((candidate) => (  
            candidate.matches(node, input)
        ));
        if (matches.length==0) { 
            if (DEBUG_LEVEL>1) console.log(`'${display_name(node)}' input '${input.name}' unmatched`)
            return undefined; 
        }
        if (matches.length>1) {
            matches.sort((a,b) => b.priority-a.priority);
            if(matches[0].priority == matches[1].priority) {
                if (DEBUG_LEVEL>1) console.log(`Ambiguous matches for '${display_name(node)}' input '${input.name}'`);
                return undefined;
            }
        }
        matches[0].note_sending_to(node, input);
        if (DEBUG_LEVEL>1) console.log(`'${display_name(node)}' input '${input.name}' matched to ${matches[0].description}`);
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