import { storage } from '../storage.js';

export function initEngineConfig(geminiChunk, groqChunk, deeplChunk, deeplSource, deeplTarget, retryEnabled) {
    const geminiInput = document.getElementById("geminiChunk");
    const groqInput = document.getElementById("groqChunk");
    const deeplInput = document.getElementById("deeplChunk");
    const deeplSourceSelect = document.getElementById("deeplSourceSelect");
    const deeplTargetSelect = document.getElementById("deeplTargetSelect");
    
    const retryBtn = document.getElementById("retryBtn");
    const retryTrack = document.getElementById("retryTrack");
    const retryThumb = document.getElementById("retryThumb");
    const retryText = document.getElementById("retryText");

    // Defaults
    geminiInput.value = geminiChunk !== undefined ? geminiChunk : 400;
    groqInput.value = groqChunk !== undefined ? groqChunk : 100;
    deeplInput.value = deeplChunk !== undefined ? deeplChunk : 150;
    deeplSourceSelect.value = deeplSource || "auto";
    deeplTargetSelect.value = deeplTarget || "tr";

    let isRetryEnabled = retryEnabled !== false; // Default true

    function setRetryUI(active) {
        if (active) {
            retryTrack.classList.add("active");
            retryThumb.classList.add("active");
            retryText.textContent = "AKTİF — Otomatik Onarım Açık";
            retryText.style.color = "#00ffd5";
        } else {
            retryTrack.classList.remove("active");
            retryThumb.classList.remove("active");
            retryText.textContent = "KAPALI — Manuel Kontrol";
            retryText.style.color = "rgba(255,255,255,0.4)";
        }
    }

    setRetryUI(isRetryEnabled);

    retryBtn.addEventListener("click", () => {
        isRetryEnabled = !isRetryEnabled;
        setRetryUI(isRetryEnabled);
        storage.set({ retryEnabled: isRetryEnabled });
    });

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
