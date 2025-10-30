
class Shared {
    graph_being_configured = false
    prompt_being_queued    = false
    in_midst_of_change     = false
    graphAnalyser          = undefined
    linkRenderController   = undefined
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

export const VERSION = "7.4.1"
