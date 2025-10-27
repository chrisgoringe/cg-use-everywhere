import { app } from "../../scripts/app.js";

export var REPEATED_TYPE_OPTIONS;
export var GROUP_RESTRICTION_OPTIONS;
export var COLOR_RESTRICTION_OPTIONS;


var _FUNCTIONAL = null
var _FUNCTIONAL_REGEX = null

const _DISPLAY = {
    'en' : {

    },
    'zn' : {

    }
}

function DISPLAY(v, lang) { return _DISPLAY[lang || current_language()]?.[v] || _DISPLAY['en'][v] || v }

function current_language() {
    return app.ui.settings.getSettingValue('Comfy.Locale')
}

export function language_changed(is_now, was_before) {
    _FUNCTIONAL = null
    _FUNCTIONAL_REGEX = null

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

function get_functional() {
    const nd = LiteGraph.createNode('KSampler')
    if (nd) {
        _FUNCTIONAL = {
            seed_input_regex : `seed|${nd.inputs.find((i)=>(i.name=='seed')).localized_name}`,
            prompt_regex     : `(_|\\b)pos(itive|_|\\b)|${nd.inputs.find((i)=>(i.name=='positive')).localized_name}`,
            negative_regex   : `(_|\\b)neg(ative|_|\\b)|${nd.inputs.find((i)=>(i.name=='negative')).localized_name}`,
        }
    }
}

function get_functional_regex() {
    if (!_FUNCTIONAL) get_functional()
    _FUNCTIONAL_REGEX = {
        prompt_regex     : new RegExp(_FUNCTIONAL.prompt_regex),
        negative_regex   : new RegExp(_FUNCTIONAL.negative_regex),
    }
}

export function i18n_functional(v) { 
    if (!_FUNCTIONAL) get_functional()
    return _FUNCTIONAL?.[v] || v
}

export function i18n_functional_regex(v) {
    if (!_FUNCTIONAL_REGEX) get_functional_regex()
    return _FUNCTIONAL_REGEX[v]
}

const all_requested_stings = new Set()
export function i18n(v, extras) {
    all_requested_stings.add(v)
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
