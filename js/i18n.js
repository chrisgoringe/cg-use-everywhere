import { app } from "../../scripts/app.js";

export var REPEATED_TYPE_OPTIONS;
export var GROUP_RESTRICTION_OPTIONS;
export var COLOR_RESTRICTION_OPTIONS;

const LANGUAGES = {
    en : "English",
    cn : "Mandarin",
}

const _FUNCTIONAL = {
    'en':{
            seed_input_regex : "seed|随机种",
            prompt_regex     : "(_|\\b)pos(itive|_|\\b)|^prompt|正面",
            negative_regex   : "(_|\\b)neg(ative|_|\\b)|负面",
        },
    'cn':{
            seed_input_regex : "seed|随机种",
            prompt_regex     : "(_|\\b)pos(itive|_|\\b)|^prompt|正面",
            negative_regex   : "(_|\\b)neg(ative|_|\\b)|负面",
        },
}

const _DISPLAY = {
    'en' : {
        prompt_regexes_text : "Prompt Everywhere",
    },
    'cn' : {
        anything : "anything chinese",
        title : "title chinese",
        input : "input chinese",
        group : "group chinese",
        Group : "Group chinese",
        Color : "Colour chinese",
        Priority : "Priority chinese",
        prompt_regexes_text : "Prompt Everywhere chinese",
        "No restrictions" : "No restrictions chinese",
        "Send only within group" : "Send only within group chinese", 
        "Send only not within group" : "Send only not within group chinese",
        "Send only to same color" : "Send only to same color chinese", 
        "Send only to different color" : "Send only to different color chinese",
        "Exact match of input names" : "Exact match of input names chinese",
        "Match start of input names" : "Match start of input names chinese",
        "Match end of input names" : "Match end of input names chinese",

        "Selected nodes" : "Selected nodes chinese",
    }
}

function DISPLAY(v, lang) { return _DISPLAY[lang || current_language()]?.[v] || _DISPLAY['en'][v] }

function current_language() {
    return app.ui.settings.getSettingValue("Use Everywhere.Language.language")
}

export function language_changed(is_now, was_before) {
    if (was_before) {
        app.graph.nodes.filter((node)=>node.IS_UE).forEach((node)=>{
            // translate node inputs
            node.inputs?.forEach((input)=>{
                if (input.label && input.label.startsWith(i18n('anything', was_before))) {
                    input.label = input.label.replace(i18n('anything', {language:was_before}), i18n('anything', {language:is_now}))
                }
            })
        })
    }
    REPEATED_TYPE_OPTIONS = [ 
        i18n("Exact match of input names"), 
        i18n("Match start of input names"), 
        i18n("Match end of input names"), 
        i18n("Inputs matches target node name"), 
    ]

    GROUP_RESTRICTION_OPTIONS = [
        i18n("No restrictions"), 
        i18n("Send only within group"), 
        i18n("Send only not within group")
    ]

    COLOR_RESTRICTION_OPTIONS = [
        i18n("No restrictions"), 
        i18n("Send only to same color"), 
        i18n("Send only to different color")
    ]
}

export function language_options() {
    const options = []
    Object.keys(LANGUAGES).forEach((k) => {options.push({value:k, text:k})})
    return options
}

export function i18n_functional(v) { return _FUNCTIONAL[current_language()]?.[v] || _FUNCTIONAL['en'][v] }

export function i18n(v, extras) {
    var r = DISPLAY(v, extras?.language) || LANGUAGES[v] || v
    if (extras?.titlecase) r = toTitleCase(r)
    return r
}

export function i18ify_settings(settings) {
    settings.forEach((s)=>{
        if (s.name)    s.name    = i18n(s.name)
        if (s.tooltip) s.tooltip = i18n(s.tooltip)
        if (s.options) s.options.forEach((o) => {o.text = i18n(o.text)})
    })
    return settings
}

const toTitleCase = (phrase) => {
  return phrase
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};