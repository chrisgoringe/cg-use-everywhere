import { is_UEnode } from "./use_everywhere_utilities.js";
import { ComfyWidgets} from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";


function active_text_widget(node, inputname, _lrc) {
    const label = document.createElement("label");
    label.setAttribute("class", "graphdialog");
    label.style.padding = "0px";
    label.style.fontSize = "14px";
    label.style.setProperty("box-shadow", "none", "important");
    label.style.borderRadius = "0";

    const label_text = document.createElement("span");
    label_text.innerText = `${inputname.substring(0,5)} `;
    label_text.style.minWidth = "60px";
    label.appendChild(label_text);

    const span = document.createElement("span");
    span.style.width = "100%";
    span.style.marginBottom = "3px";
    label.appendChild(span);

    const inputEl = document.createElement("input");
    inputEl.setAttribute("type", "text");
    inputEl.setAttribute("list", "uedynamiclist");
    inputEl.setAttribute("value", ".*");
    inputEl.style.fontSize = "14px";
    inputEl.style.borderRadius = "0";
    inputEl.style.margin = "0px";
    inputEl.style.width = "100%";
    inputEl.style.float = "right";
    span.appendChild(inputEl);
    // do style

    const widget = node.addDOMWidget(inputname, "input", label, {
        getValue() { return inputEl.value; },
        setValue(v) {
            inputEl.value = v; 
        },
    });
    widget.inputEl = label;
    widget.computeSize = function (parent_width) {
        return [parent_width ? parent_width : 400,30];
    }
    
    inputEl.addEventListener("focus", () => {
        const d = document.getElementById("uedynamiclist");
        while (d.firstChild) { d.removeChild(d.lastChild); };
        const options = ["Vanilla", "Chocolate", "Strawberry"];  // Get the real list!
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


    return { widget };
}

function add_autoprompts(_lrc) {
    const STRING = ComfyWidgets.STRING;
    ComfyWidgets.STRING = function (node, inputName, inputData, app) {
        if (!is_UEnode(node) || !inputName?.includes("regex")) {
            return STRING.apply(this, arguments);
        }
        return active_text_widget(node, inputName, _lrc);
    }
    const datalist = document.createElement("datalist");
    datalist.id = "uedynamiclist";    
    document.body.append(datalist);
}


export { add_autoprompts }