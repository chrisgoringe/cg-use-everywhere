export const VERSION = "7.5.2"

class Shared {
    constructor() {
        this.graph_being_configured   = 0
        this.in_queuePrompt           = 0
        this.in_graphToPrompt         = 0
        this.in_midst_of_change       = 0
        this.graph_currently_modified = 0
        this.graphAnalyser            = undefined
        this.linkRenderController     = undefined
        this.report_keys = [ 'graph_being_configured', 'in_queuePrompt', 'in_graphToPrompt', 'in_midst_of_change', 'graph_currently_modified' ]
    }
}

class Deferred {
    constructor() { 
        this.action_list = []
        setInterval( this.execute.bind(this), 200 )
    }
    push(x) { this.action_list.push(x) } // add action of the form: { fn:function, args:array }
    execute() {
        if (shared.in_midst_of_change) return;
        if (shared.graph_being_configured) return;
        while (this.action_list.length>0) {
            const action = this.action_list.pop()
            try { action?.fn(...action?.args) } 
            catch (e) { Logger.log_error(e) }
        }
    }
}

export const deferred_actions = new Deferred()

export const shared = new Shared()

