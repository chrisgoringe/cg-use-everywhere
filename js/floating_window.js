import { create } from "./use_everywhere_utilities.js"
import { settingsCache } from "./use_everywhere_cache.js"


export class FloatingWindow extends HTMLElement {
    constructor() {
        super()
        this.classList.add('ue_editor')
        this.header = create('div', 'ue_editor_header', this)  
        this.body   = create('div', 'ue_editor_body', this)  
        this.footer = create('button', 'ue_editor_footer', this, { innerText: "Close" })  

        /** @type {HTMLElement | null} */
        this.firstFocusable = null
        /** @type {HTMLElement | null} */
        this.lastFocusable = null

        this.header.addEventListener('mousedown',this.start_dragging.bind(this))
        this.addEventListener('mousemove', this.mousemovedover.bind(this))
        document.addEventListener('mousemove', this.mousemoved.bind(this))
        document.addEventListener('mouseup',this.stop_dragging.bind(this))
        document.addEventListener('mouseleave',this.stop_dragging.bind(this))
        this.footer.addEventListener('click', this.hide.bind(this))
        this.addEventListener("keydown", this.handle_keydown.bind(this));

        this.dragging = false
        this.hide()
        document.body.append(this)
    }

    show() { 
        this.style.display = 'flex';
        const tt = document.getElementById('ue_tooltip')
        if (tt) tt.style.display = 'none' 
        this.showing = true
    }
    hide() { 
        this.style.display = 'none' 
        this.showing = false
    }
    set_title(title) { 
        this.header.innerText = title 
    }
    set_body(element) {
        this.body.innerHTML = ""
        this.body.appendChild(element)
        this.setup_focus_trap()
    }

    maybe_move_to(x,y) {
        if (this.position && settingsCache.getSettingValue("Use Everywhere.Graphics.preserve edit window position")) return
        this.move_to(x,y)
    }

    move_to(x,y) {
        this.position = {x:x,y:y}
        this.style.left = `${this.position.x}px`
        this.style.top = `${this.position.y}px`
    }

    swallow(e) {
        e.stopPropagation()
        e.preventDefault()
    }

    start_dragging(e) {
        this.dragging = true
        this.swallow(e)
    }

    stop_dragging(e) {
        this.dragging = false
    }

    mousemovedover(e) {
        this.mousemoved(e)
        this.swallow(e)
    }

    mousemoved(e) {
        if (this.dragging) this.move_to( this.position.x + e.movementX , this.position.y + e.movementY )
    }

    /** @param {KeyboardEvent} e  */
    handle_keydown(e) {
        if (e.key === "Escape" || e.key === "Enter") {
            this.hide()
            return
        }
        if (e.key === "Tab") {
            if (e.shiftKey && document.activeElement === this.firstFocusable) {
                this.lastFocusable.focus()
                e.preventDefault()
                return
            }
            if (!e.shiftKey && document.activeElement === this.lastFocusable) {
                this.firstFocusable.focus()
                e.preventDefault()
            }
        }
    }

    setup_focus_trap() {
        this.firstFocusable = null
        this.lastFocusable = null

        const focusableEls = this.querySelectorAll('a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled])')
        if (focusableEls?.length == 0) return

        this.firstFocusable = focusableEls[0] ?? null
        this.lastFocusable  = focusableEls[focusableEls.length - 1] ?? null

        if (this.firstFocusable) {
            setTimeout(() => {
                this.firstFocusable.focus()
            }, 0);
        }
    }
}


customElements.define('ue-floating',  FloatingWindow)
export const edit_window = new FloatingWindow()
