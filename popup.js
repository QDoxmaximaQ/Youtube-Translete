import { storage } from './Popup/storage.js';
import { initToggle } from './Popup/components/Toggle.js';
import { initModelSelect } from './Popup/components/ModelSelect.js';
import { initModeSelect } from './Popup/components/ModeSelect.js';
import { initApiKey } from './Popup/components/ApiKey.js';
import { initCustomPrompts } from './Popup/components/Prompts.js';
import { initEngineConfig } from './Popup/components/EngineConfig.js';
import { initStatusBar } from './Popup/components/StatusBar.js';

storage.get([
    "isActive", 
    "selectedModel", 
    "translationMode", 
    "apiKey", 
    "groqApiKey", 
    "deeplApiKey",
    "geminiPrompt", 
    "groqPrompt",
    "geminiChunk",
    "groqChunk",
    "deeplChunk",
    "deeplSource",
    "deeplTarget",
    "retryEnabled"
], (data) => {
    initToggle(data.isActive === true);
    initModelSelect(data.selectedModel);
    initModeSelect(data.translationMode);
    initApiKey(data.apiKey, data.groqApiKey, data.deeplApiKey);
    initCustomPrompts(data.geminiPrompt, data.groqPrompt);
    initEngineConfig(data.geminiChunk, data.groqChunk, data.deeplChunk, data.deeplSource, data.deeplTarget, data.retryEnabled);
    initStatusBar();

    // Kaydet Butonu
    const saveBtn = document.getElementById("saveBtn");
    const statusBar = document.getElementById("statusBar");

    saveBtn.addEventListener("click", () => {
        statusBar.textContent = "AYARLAR KAYDEDİLDİ";
        statusBar.style.color = "#00ffd5";
        
        // Asıl veriler zaten inputlara girildikçe arka planda 500ms debounce ile kaydediliyor.
        // Bu buton kullanıcının içi rahat etsin diye manuel kaydetme hissi verir.
        // Dilersek burada tekrar manuel bir storage.set çağrısı yapabiliriz.
        setTimeout(() => {
            statusBar.textContent = "SİSTEM: HAZIR";
            statusBar.style.color = "#00ffd5";
        }, 2000);
    });
});