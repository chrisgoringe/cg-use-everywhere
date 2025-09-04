import { app } from "../../scripts/app.js";

export var REPEATED_TYPE_OPTIONS;
export var GROUP_RESTRICTION_OPTIONS;
export var COLOR_RESTRICTION_OPTIONS;

const _FUNCTIONAL = {
    'en':{
            seed_input_regex : "seed|随机种",
            prompt_regex     : "(_|\\b)pos(itive|_|\\b)|^prompt|正面",
            negative_regex   : "(_|\\b)neg(ative|_|\\b)|负面",
        },
}

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

export function i18n_functional(v) { 
    return _FUNCTIONAL[current_language()]?.[v] || _FUNCTIONAL['en'][v] 
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

/*
"Version 7.1"
"Show links"
"All off"
"Selected nodes"
"Mouseover node"
"Selected and mouseover nodes"
"All on"
"Statically distinguish UE links"
"Render UE links, when shown, differently from normal links. Much lower performance cost than animation."
"Animate UE links"
"Animating links may have a negative impact on UI performance. Consider using Statically distinguish UE links instead."
"Off"
"Dots"
"Pulse"
"Both"
"Turn animation off when workflow is running"
"Highlight connected and connectable inputs"
"Save restrictions edit window position"
"If off, the edit window appears where the mouse is"
"Show restrictions as tooltip"
"Connect to bypassed nodes"
"By default UE links are made to the node downstream of bypassed nodes."
"Check for loops before submitting"
"Check to see if UE links have created a loop that wasn't there before"
"Logging"
"Errors Only"
"Problems"
"Information"
"Detail"
"Block workflow validation"
"Turn off workflow validation (which tends to replace UE links with real ones)"
"Exact match of input names"
"Match start of input names"
"Match end of input names"
"Inputs matches target node name"
"No restrictions"
"Send only within group"
"Send only not within group"
"Send only to same color"
"Send only to different color"
"anything"
"title"
"input"
"group"
"Group"
"Color"
"Repeated Types"
"Priority"
*/