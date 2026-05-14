import { storage } from '../storage.js';

export function initApiKey(geminiKey, groqKey, deeplKey) {
    const geminiInput = document.getElementById("geminiKeyInput");
    const groqInput = document.getElementById("groqKeyInput");
    const deeplInput = document.getElementById("deeplKeyInput");

    if (geminiKey) geminiInput.value = geminiKey;
    if (groqKey) groqInput.value = groqKey;
    if (deeplKey) deeplInput.value = deeplKey;

    let timeout = null;
    const saveKeys = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            storage.set({ 
                apiKey: geminiInput.value.trim(),
                groqApiKey: groqInput.value.trim(),
                deeplApiKey: deeplInput.value.trim()
            });
        }, 500);
    };

    geminiInput.addEventListener("input", saveKeys);
    groqInput.addEventListener("input", saveKeys);
    deeplInput.addEventListener("input", saveKeys);
}
