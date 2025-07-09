
const FUNCTIONAL = {
    seed_input_regex : "seed|随机种",
    prompt_regex     : "(_|\\b)pos(itive|_|\\b)|^prompt|正面",
    negative_regex   : "(_|\\b)neg(ative|_|\\b)|负面",
}

const DISPLAY = {
    title : "title",
    input : "input",
    group : "group",
    Group : "Group",
    Color : "Colour",
    Priority : "Priority",
    prompt_regexes_text : "Prompt Everywhere"
}

export function i18n(v) {
    return DISPLAY[v] || v
}

export function default_regex(v) {
    return FUNCTIONAL[v] 
}