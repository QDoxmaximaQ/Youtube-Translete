import { storage } from '../storage.js';

export function initEngineConfig(geminiChunk, groqChunk, deeplChunk, deeplSource, deeplTarget) {
    const geminiInput = document.getElementById("geminiChunk");
    const groqInput = document.getElementById("groqChunk");
    const deeplInput = document.getElementById("deeplChunk");
    const deeplSourceSelect = document.getElementById("deeplSourceSelect");
    const deeplTargetSelect = document.getElementById("deeplTargetSelect");

    // Defaults
    geminiInput.value = geminiChunk !== undefined ? geminiChunk : 400;
    groqInput.value = groqChunk !== undefined ? groqChunk : 100;
    deeplInput.value = deeplChunk !== undefined ? deeplChunk : 150;
    deeplSourceSelect.value = deeplSource || "auto";
    deeplTargetSelect.value = deeplTarget || "tr";

    let timeout = null;
    const saveSettings = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            storage.set({ 
                geminiChunk: parseInt(geminiInput.value) || 400,
                groqChunk: parseInt(groqInput.value) || 100,
                deeplChunk: parseInt(deeplInput.value) || 150,
                deeplSource: deeplSourceSelect.value,
                deeplTarget: deeplTargetSelect.value
            });
        }, 500);
    };

    geminiInput.addEventListener("input", saveSettings);
    groqInput.addEventListener("input", saveSettings);
    deeplInput.addEventListener("input", saveSettings);
    deeplSourceSelect.addEventListener("change", saveSettings);
    deeplTargetSelect.addEventListener("change", saveSettings);
}
