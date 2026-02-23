import { any_restrictions } from "./ue_properties.js";
import { shared } from "./shared.js";

export function titlebar_color(node) {
    const restricted = any_restrictions(node);
    const sending    = shared.linkRenderController.node_sending_anywhere(node);

    return restricted ? ( sending ? "rgba(255, 255, 72, 1)" : "rgba(255, 255, 72, 0.35)" ) :
                        ( sending ? "rgba(72, 255, 72, 1)" : "rgba(72, 255, 72, 0.35)" );
}