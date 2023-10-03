const DEBUG = true

function display_name(node) { return (node?.title) ? node.title : node.properties['Node name for S&R']; }

class UseEverywhere {
    constructor() {
        this.sending_to = [];
        Object.assign(this, arguments[0]);
        if (this.priority === undefined) this.priority = 0;
        this.description = `Priority ${this.priority} Type "${this.type}" from (node, output) (${this.output})`;
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
        this.sending_to.push({node:node, input:input})
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
    constructor() { 
        this.ues = []; 
        this.as_string = ""; 
    }

    add_ue(type, output, title_regex, input_regex, priority) {
        const params = {
            type: type,
            output: output,
            title_regex: title_regex,
            input_regex: input_regex,
            priority: priority
        }
        const ue = new UseEverywhere(params);
        this.ues.push(ue);
        this.as_string = `${params},${this.as_string}`;
        if (DEBUG) console.log(`UE: added ${params}`)
    }

    find_best_match(node, input) {
        var matches = this.ues.filter((candidate) => (  
            candidate.matches(node, input)
        ));
        if (matches.length==0) { return undefined; }
        if (matches.length>1) {
            matches.sort((a,b) => b.priority-a.priority);
            if(matches[0].priority == matches[1].priority) {
                if (DEBUG) console.log(`Everywhere nodes found ambiguous matches for '${display_name(node)}' input '${input.name}'`);
                return undefined;
            }
        }
        matches[0].note_sending_to(node, input);
        return matches[0];        
    }

    print_all() {
        this.ues.forEach((ue) => { console.log(ue.describe()); });
    }
}

export {UseEverywhereList}