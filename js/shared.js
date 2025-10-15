
class Shared {
    graph_being_configured = false
    prompt_being_queued    = false
    graphAnalyser          = undefined
    linkRenderController   = undefined
}

export const shared = new Shared()

export const VERSION = "7.4"
