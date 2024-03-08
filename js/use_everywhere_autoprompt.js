import { is_UEnode } from "./use_everywhere_utilities.js";
import { ComfyWidgets} from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";


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
    
    widget.colorFollower = function (color) { label.style.backgroundColor = color; } 
    return { widget };
}

function add_autoprompts(_lrc) {
    const STRING = ComfyWidgets.STRING;
    ComfyWidgets.STRING = function (node, inputName, inputData, app) {
        if (!is_UEnode(node) || !inputName?.includes("regex") || !app.ui.settings.getSettingValue('AE.autoprompt', true)) {
            return STRING.apply(this, arguments);
        }
        return active_text_widget(node, inputName, _lrc);
    }
    const datalist = document.createElement("datalist");
    datalist.id = "uedynamiclist";    
    document.body.append(datalist);
}


export { add_autoprompts }