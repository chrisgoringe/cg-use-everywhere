import { app } from "../../scripts/app.js";
function main_menu_settings() {

    app.ui.settings.addSetting({
        id: "AE.details",
        name: "Anything Everywhere show node details",
        type: "boolean",
        defaultValue: false,
    });
    app.ui.settings.addSetting({
        id: "AE.autoprompt",
        name: "Anything Everywhere? autocomplete (may require page reload)",
        type: "boolean",
        defaultValue: true,
    });
    app.ui.settings.addSetting({
        id: "AE.checkloops",
        name: "Anything Everywhere check loops",
        type: "boolean",
        defaultValue: true,
    });        
    app.ui.settings.addSetting({
        id: "AE.mouseover",
        name: "Anything Everywhere show links on mouse over",
        type: "boolean",
        defaultValue: false,
    });
    app.ui.settings.addSetting({
        id: "AE.animate",
        name: "Anything Everywhere animate UE links",
        type: "combo",
        options: [ {value:0, text:"Off"}, {value:1, text:"Dots"}, {value:2, text:"Pulse"}, {value:3, text:"Both"}, ],
        defaultValue: 3,
    });
    app.ui.settings.addSetting({
        id: "AE.highlight",
        name: "Anything Everywhere highlight connected nodes",
        type: "boolean",
        defaultValue: true,
    });
    app.ui.settings.addSetting({
        id: "AE.replacesearch",
        name: "Anything Everywhere replace search",
        type: "boolean",
        defaultValue: true,
    });
}

export { main_menu_settings }