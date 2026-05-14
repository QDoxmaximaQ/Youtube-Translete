import { storage } from '../storage.js';
import { translationModes } from '../config.js';

export function initModeSelect(initialMode) {
    const modeSelect = document.getElementById("modeSelect");

    translationModes.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.code;
        opt.textContent = m.name;
        modeSelect.appendChild(opt);
    });

    modeSelect.value = initialMode || "tr";

    modeSelect.addEventListener("change", () => {
        storage.set({ translationMode: modeSelect.value });
    });
}
