import { is_UEnode } from "./use_everywhere_utilities.js";
import { ComfyWidgets} from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";
import { LinkRenderController } from "./use_everywhere_ui.js";

function format_color(color) {
    if (!color) return color;
    if (color.length==7) return `${color}FF`;
    if (color.length==9) return color;
    if (color.length==3) {
        var h = color.slice(1);
        h = [...h].map(x => x + x).join('');
        return `#${h}FF`;
    }
    console.log(`Couldn't process color ${color}`);
    return color;
}

function active_text_widget(node, inputname, _lrc) {
    const label = document.createElement("label");
    label.className = "graphdialog ueprompt";

    const label_text = document.createElement("span");
    label_text.innerText = `${inputname.substring(0,5)} `;
    label_text.className = "ueprompttext";
    label.appendChild(label_text);

    const span = document.createElement("span");
    span.className = "uepromptspan";
    label.appendChild(span);

    const inputEl = document.createElement("input");
    inputEl.setAttribute("type", "text");
    inputEl.setAttribute("list", "uedynamiclist");
    inputEl.setAttribute("value", ".*");
    inputEl.className = "uepromptinput";
    span.appendChild(inputEl);
 
    const widget = node.addDOMWidget(inputname, "input", label, {
        getValue() { return inputEl.value; },
        setValue(v) { inputEl.value = v; },
    });
    
    widget.computeSize = function (parent_width) {
        return [parent_width ? parent_width : 400, inputname=="group_regex"? 30 : 26];
    }
    
    inputEl.addEventListener("focus", () => {
        if (inputEl.value==".*") inputEl.value = "";
        const d = document.getElementById("uedynamiclist");
        while (d.firstChild) { d.removeChild(d.lastChild); };
        let options;
        if (inputname=="title_regex") { options = _lrc.ue_list.all_nodes_with_unmatched_input(node.input_type[0]); }
        else if (inputname=="input_regex") { options = _lrc.ue_list.all_unmatched_input_names(node.input_type[0]); }
        else if (inputname=="group_regex") { options = _lrc.ue_list.all_group_names(node.input_type[0]); }
        else options = [];
        options.forEach((option) => {
            const theOption = document.createElement("option");
            theOption.setAttribute("value", option);
            d.appendChild(theOption)
        })
    });
    inputEl.addEventListener("input", () => {
        _lrc.mark_link_list_outdated();
        app.graph.setDirtyCanvas(true,true);
    })
    
    widget.colorFollower = function (color, mode) { 
        if (mode==4) {
            if (color!='#FF00FF') label.restoreColor = format_color(color);
            label.style.backgroundColor = "#FF00FF00";
            label.style.opacity = 0.2;
            return;
        }
        label.style.backgroundColor = format_color(color);
        label.style.opacity = 1.0;
    }

    widget.endBypass = function() {
        if (label.restoreColor) {
            label.style.backgroundColor = label.restoreColor;
            label.restoreColor = false;      
        }
        label.style.opacity = 1.0;    
    }

    node.loaded_when_collapsed = function() {
        node.widgets?.forEach((widget) => {
            if (widget.element) {
                widget.element.hidden = true;
                widget.element.style.display = "none";
            }
        })
    }

    //const onRemove = widget.onRemove;
    //widget.onRemove = function() {
    //    onRemove?.apply(this, arguments);
    //    document.body.removeChild(widget.element);
   // }
    return { widget };
}

function add_autoprompts() {
    const STRING = ComfyWidgets.STRING;
    ComfyWidgets.STRING = function (node, inputName, inputData, app) {
        if (!is_UEnode(node) || !inputName?.includes("regex") || !app.ui.settings.getSettingValue('AE.autoprompt', true)) {
            return STRING.apply(this, arguments);
        }
        return active_text_widget(node, inputName, LinkRenderController.instance());
    }
    const datalist = document.createElement("datalist");
    datalist.id = "uedynamiclist";    
    document.body.append(datalist);
}


export { add_autoprompts }