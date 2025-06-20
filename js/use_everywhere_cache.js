import { app } from "../../scripts/app.js";

class LocalSettingsCache {
    constructor() {
        this.local_settings = {}
        this.callbacks = {}
    }
    getSettingValue(key) {
        if (this.local_settings[key]===undefined) this.local_settings[key] = app.ui.settings.getSettingValue(key)
        return this.local_settings[key]
    }
    onSettingChangeChange(new_value, old_value) {
        this.onSettingChange(new_value, old_value)
        app.graph?.change.bind(app.graph)()
    }
    onSettingChange(new_value, old_value) {
        settingsCache.local_settings[this.id] = new_value
        this.callbacks[this.id]?.(new_value, old_value)
    }
    addCallback(id, callback) {
        this.callbacks[id] = callback
    }
}

export const settingsCache = new LocalSettingsCache()