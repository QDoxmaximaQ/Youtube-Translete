import { storage } from './Popup/storage.js';
import { initToggle } from './Popup/components/Toggle.js';
import { initModelSelect } from './Popup/components/ModelSelect.js';
import { initModeSelect } from './Popup/components/ModeSelect.js';
import { initApiKey } from './Popup/components/ApiKey.js';
import { initCustomPrompts } from './Popup/components/Prompts.js';
import { initEngineConfig } from './Popup/components/EngineConfig.js';
import { initStatusBar } from './Popup/components/StatusBar.js';
import { initPlayerConfig } from './Popup/components/PlayerConfig.js';

let translations = {};

async function loadTranslations() {
    try {
        const response = await fetch('menu-dili.json');
        translations = await response.json();
    } catch (e) {
        console.error("[YT-Sub] Dil dosyası yüklenemedi:", e);
    }
}

function applyLanguage(lang) {
    if (!translations[lang]) lang = "tr";
    const strings = translations[lang];

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (strings[key]) {
            el.textContent = strings[key];
        }
    });
    
    // Toggle Text Güncelleme (Geçerli state'e göre)
    const toggleText = document.getElementById("statusText");
    if (toggleText) {
        toggleText.textContent = document.getElementById("toggleTrack")?.classList.contains("active") ? strings["ACTIVE"] : strings["INACTIVE"];
    }
}

async function init() {
    await loadTranslations();

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
        "playerActive",
        "playerFontFamily",
        "playerFontSize",
        "playerTextColor",
        "playerBgColor",
        "playerBgOpacity",
        "playerLineGap",
        "menuLang"
    ], (data) => {
        const langSelect = document.getElementById("menuLangSelect");
        const currentLang = data.menuLang || "tr";
        langSelect.value = currentLang;
        
        applyLanguage(currentLang);

        langSelect.addEventListener("change", (e) => {
            const selectedLang = e.target.value;
            storage.set({ menuLang: selectedLang });
            applyLanguage(selectedLang);
        });

        initToggle(data.isActive === true);
        initModelSelect(data.selectedModel);
        initModeSelect(data.translationMode);
        initApiKey(data.apiKey, data.groqApiKey, data.deeplApiKey);
        initCustomPrompts(data.geminiPrompt, data.groqPrompt);
        initEngineConfig(data.geminiChunk, data.groqChunk, data.deeplChunk, data.deeplSource, data.deeplTarget);
        initPlayerConfig(data);
        initStatusBar();

        // Kaydet Butonu
        const saveBtn = document.getElementById("saveBtn");
        const statusBar = document.getElementById("statusBar");

        saveBtn.addEventListener("click", () => {
            statusBar.textContent = translations[langSelect.value]?.["STATUS_SAVED"] || "AYARLAR KAYDEDİLDİ";
            statusBar.style.color = "#00ffd5";
            
            setTimeout(() => {
                statusBar.textContent = translations[langSelect.value]?.["STATUS_READY"] || "SİSTEM: HAZIR";
            }, 2000);
        });
    });
}

init();