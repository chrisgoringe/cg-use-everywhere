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

function intersect(a, b) {
	const x = Math.max(a.x, b.x);
	const num1 = Math.min(a.x + a.width, b.x + b.width);
	const y = Math.max(a.y, b.y);
	const num2 = Math.min(a.y + a.height, b.y + b.height);
	if (num1 >= x && num2 >= y) return [x, y, num1 - x, num2 - y];
	else return null;
}

function union(a,b) {
    if (!b) return a;
    if (!a) return b;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y,b.y);
    const width = Math.max(a.x+a.width, b.x+b.width) - x;
    const height = Math.max(a.y+a.height, b.y+b.height) - x;
    return { x:x, y:y, width:width, height:height };
}

function getClipPath(node, element) {
    const scale = app.canvas.ds.scale;
    const widgetRect = element.getBoundingClientRect();
    var onTopOfMe = false;
    var clip = null;
    app.graph._nodes.forEach((other_node) => {
        if (other_node.id == node.id) {
            onTopOfMe = true;
        }
        else if (onTopOfMe) {
            const MARGIN = other_node.is_selected ? 7 : 2;
            const bounding = other_node.getBounding();
            const intersection = intersect(
                { x: widgetRect.x / scale, y: widgetRect.y / scale, width: widgetRect.width / scale, height: widgetRect.height / scale },
                {
                    x: other_node.pos[0] + app.canvas.ds.offset[0] - MARGIN,
                    y: other_node.pos[1] + app.canvas.ds.offset[1] - LiteGraph.NODE_TITLE_HEIGHT - MARGIN,
                    width: bounding[2] + MARGIN + MARGIN,
                    height: bounding[3] + MARGIN + MARGIN,
                }
            );
            if (intersection) {
                clip = union(clip, { 
                    x : intersection[0] - widgetRect.x / scale, 
                    y : intersection[1] - widgetRect.y / scale,
                    width : intersection[2],
                    height : intersection[3]
                })
                //const newpath = `0% 0%, 0% 100%, ${clipX} 100%, ${clipX} ${clipY}, calc(${clipX} + ${clipWidth}) ${clipY}, calc(${clipX} + ${clipWidth}) calc(${clipY} + ${clipHeight}), ${clipX} calc(${clipY} + ${clipHeight}), ${clipX} 100%, 100% 100%, 100% 0%`;
                //path = path != '' ? `${path}, ${newpath}` : newpath;
            }
        }
    })
    const path = clip ? `polygon(0% 0%, 0% 100%, ${clip.x}px 100%, ${clip.x}px ${clip.y}px, ${clip.x + clip.width}px ${clip.y}px, ${clip.x + clip.width}px ${clip.y + clip.height}px, ${clip.x}px ${clip.y + clip.height}px, ${clip.x}px 100%, 100% 100%, 100% 0%)` : '';
	return path;
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
                w.element.style.zIndex = 0;
                const p = getClipPath(node, w.element);
                w.element.style.clipPath = p;
                let a;
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