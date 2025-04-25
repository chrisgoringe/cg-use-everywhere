import { app } from "../../scripts/app.js";

class LocalSettingsCache {
    constructor() {
        this.local_settings = {}
    }
    getSettingValue(key) {
        if (this.local_settings[key]===undefined) this.local_settings[key] = app.ui.settings.getSettingValue(key)
        return this.local_settings[key]
    }
    onSettingChangeChange(new_value, old_value) {
        settingsCache.local_settings[this.id] = new_value
        app.graph?.change.bind(app.graph)
    }
    onSettingChange(new_value, old_value) {
        settingsCache.local_settings[this.id] = new_value
    }
}

export const settingsCache = new LocalSettingsCache()