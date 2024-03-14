import { is_UEnode } from "./use_everywhere_utilities.js";
import { ComfyWidgets} from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";
import { LinkRenderController } from "./use_everywhere_ui.js";

function update_picklist(node, inputname) {
    const d = document.getElementById("uedynamiclist");
    while (d.firstChild) { d.removeChild(d.lastChild); };
    let options = [];
    if (inputname=="title_regex") { options = LinkRenderController.instance().ue_list?.all_nodes_with_unmatched_input(node.input_type[0]); }
    else if (inputname=="input_regex") { options = LinkRenderController.instance().ue_list?.all_unmatched_input_names(node.input_type[0]); }
    else if (inputname=="group_regex") { options = LinkRenderController.instance().ue_list?.all_group_names(node.input_type[0]); }
    options.forEach((option) => {
        const theOption = document.createElement("option");
        theOption.setAttribute("value", option);
        d.appendChild(theOption)
    })
}

function active_text_widget(node, inputname) {
    const label = document.createElement("label");
    label.className = "graphdialog ueprompt";
    label.style.display = "none";

    const label_text = document.createElement("span");
    label_text.innerText = `${inputname.substring(0,5)} `;
    label_text.className = "ueprompttext";
    label.appendChild(label_text);

    const span = document.createElement("span");
    span.className = "uepromptspan";
    label.appendChild(span);

    const inputEl = document.createElement("input");
    inputEl.setAttribute("type", "text");
    inputEl.className = "uepromptinput";
    span.appendChild(inputEl);
 
    const widget = node.addDOMWidget(inputname, "input", label, {
        getValue() { return inputEl.value; },
        setValue(v) { inputEl.value = v; },
        onDraw(w) { 
            // are we the most recently selected node? 
            if (Object.values(app.canvas.selected_nodes)[0]?.id == node.id) {
                // if so, turn off DOM clipping
                w.element.style.clipPath = null; w.element.style.willChange = null; 
            } else {
                //w.element.style.zIndex = 0;
            }
        }
    });
    widget.element.hidden = true;

    inputEl.onmousedown = function(e) {
        const x = app.canvas.prompt("Value",widget.value,function(v) { this.value = v; }.bind(widget), e, false );
        const input = x.getElementsByClassName("value")[0];
        input.setAttribute("list", "uedynamiclist");
        input.parentNode.style.zIndex = `${parseInt(label.style.zIndex ? label.style.zIndex : '0')+1}`;
        input.addEventListener("input", function (v) {
            widget.value = this.value;
            LinkRenderController.instance().mark_link_list_outdated();
            app.graph.setDirtyCanvas(true,true);
        }.bind(input));
        update_picklist(node, inputname);
        e.stopImmediatePropagation();
    }
    
    widget.computeSize = function (parent_width) {
        return parent_width ? [parent_width, 27] : [400, 20];
    }
    
    inputEl.addEventListener("focus", () => {
        if (inputEl.value==".*") inputEl.value = "";
    });
    
    widget.onModeChange = function (mode) { 
        label.style.opacity = mode==4 ? 0.2 : 1.0;
    }

    node.loaded_when_collapsed = function() {
        node.widgets?.forEach((widget) => {
            if (widget.element) {
                widget.element.hidden = true;
                widget.element.style.display = "none";
            }
        })
    }

    return { widget };
}

function activate(node, widget) {
    if (node.flags?.collapsed) return;
    widget.element.hidden = false;
    widget.element.style.display = "";
}

function add_autoprompts() {
    const STRING = ComfyWidgets.STRING;
    ComfyWidgets.STRING = function (node, inputName, inputData, app) {
        if (!is_UEnode(node) || !inputName?.includes("regex") || !app.ui.settings.getSettingValue('AE.autoprompt', true)) {
            return STRING.apply(this, arguments);
        }
        const atw = active_text_widget(node, inputName);
        const orig_onAdded = node.onAdded;
        node.onAdded = function () {
            orig_onAdded?.apply(this, arguments);
            activate(node, atw.widget);
        }
        return atw;
    }
    const datalist = document.createElement("datalist");
    datalist.id = "uedynamiclist";    
    document.body.append(datalist);
}

function node_added(node) {
    const a = 1;
}


export { add_autoprompts }