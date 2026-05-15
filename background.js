// ===========================================================
// background.js — Service Worker (ES Module)
// Tüm modülleri import eder ve akışı yönetir
// ===========================================================

import { YoutubeEngine } from "./Temizleme/cleaner.js";
import { translateWithGemini } from "./AiVerisi/gemini.js";
import { translateWithDeepL } from "./AiVerisi/deepl.js";

function logTerminal(msg) {
    console.log(msg);
    chrome.runtime.sendMessage({ type: "TERMINAL_LOG", message: msg }).catch(() => {});
}

logTerminal("[YT-Sub] Service worker aktif");

// ---------------------------------------------------
// Content script'ten gelen mesajları dinle
// ---------------------------------------------------
const activeTranslationTasks = {}; // tabId -> taskId (Çeviri iptal mekanizması için)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "VIDEO_CHANGED") {
        if (sender.tab?.id) {
            logTerminal(`[YT-Sub] Sayfa/Video değişti, önceki çeviri iptal ediliyor. Sekme: ${sender.tab.id}`);
            activeTranslationTasks[sender.tab.id] = null; // Aktif çeviriyi durdur
        }
        sendResponse({ success: true });
        return false;
    }

    if (message.type === "SUBTITLE_CAPTURED") {
        logTerminal(`[YT-Sub] Altyazı yakalandı. Sekme: ${sender.tab?.id}`);
        
        const taskId = Date.now();
        if (sender.tab?.id) {
            activeTranslationTasks[sender.tab.id] = taskId;
        }

        // Hemen yanıt dönerek portun kapanmasını önle
        sendResponse({ success: true, message: "Çeviri arka planda başlatıldı." });
        
        handleSubtitle(message.rawText, sender.tab?.id, taskId).catch(err => {
            logTerminal(`[HATA] Çeviri hatası: ${err.message}`);
        });

        // false dönüyoruz çünkü sendResponse'u senkron olarak hemen çağırdık
        return false;
    }
});

// ---------------------------------------------------
// Ana iş akışı: Yakalama → Parse → Payload → Prompt/DeepL → API → Rebuild
// ---------------------------------------------------
async function handleSubtitle(rawText, tabId, taskId) {
    // 1. Ayarları al
    const settings = await chrome.storage.local.get([
        "isActive",
        "selectedModel",
        "apiKey",
        "deeplApiKey",
        "translationMode",
        "geminiPrompt",
        "groqPrompt",
        "geminiChunk",
        "groqChunk",
        "deeplChunk",
        "deeplSource",
        "deeplTarget",
        "retryEnabled"
    ]);

    // Aktif değilse çık
    if (!settings.isActive) {
        logTerminal("[YT-Sub] Uzantı pasif, işlem atlanıyor.");
        return { skipped: true, reason: "inactive" };
    }

    const model = settings.selectedModel || "gemini-2.5-flash";
    const isGemini = model.startsWith("gemini");
    const isDeepL = model.startsWith("DeepL");

    if (!isGemini && !isDeepL) {
        logTerminal(`[UYARI] "${model}" henüz desteklenmiyor.`);
        if (tabId) {
            chrome.tabs.sendMessage(tabId, {
                type: "TRANSLATION_ERROR",
                error: `"${model}" modeli henüz desteklenmiyor.`
            });
        }
        return { skipped: true, reason: "unsupported_model" };
    }

    const activeApiKey = isDeepL ? settings.deeplApiKey : settings.apiKey;

    if (!activeApiKey) {
        logTerminal(`[UYARI] ${isDeepL ? 'DeepL' : 'Gemini'} API Key ayarlanmamış.`);
        if (tabId) {
            chrome.tabs.sendMessage(tabId, {
                type: "TRANSLATION_ERROR",
                error: `${isDeepL ? 'DeepL' : 'Gemini'} API Key ayarlanmamış. Uzantı popup'ından API Key girin.`
            });
        }
        return { skipped: true, reason: "no_api_key" };
    }

    // 2. Temizleme ve Payload Hazırlığı
    logTerminal("[YT-Sub] Altyazı ayrıştırılıyor...");
    const blocks = YoutubeEngine.parseBlocks(rawText);

    if (blocks.length === 0) {
        logTerminal("[UYARI] Temizlenmiş altyazı boş.");
        return { skipped: true, reason: "empty_subtitles" };
    }

    const chunkSize = isDeepL ? (settings.deeplChunk || 150) : (isGemini ? (settings.geminiChunk || 400) : (settings.groqChunk || 100));
    const retryEnabled = settings.retryEnabled !== false; // Default true

    logTerminal(`[YT-Sub] ${blocks.length} blok bulundu. Chunk size: ${chunkSize}`);
    const { payloads, metadata } = YoutubeEngine.preparePayload(blocks, chunkSize);

    const engineSettings = {
        translationMode: settings.translationMode || "tr",
        geminiPrompt: settings.geminiPrompt || "",
        groqPrompt: settings.groqPrompt || ""
    };
    
    let allTranslatedText = "";

    // 3. Her bir Chunk için API'yi çağır (Retry mekanizması ile)
    for (let i = 0; i < payloads.length; i++) {
        // Eğer çeviri iptal edildiyse veya yeni video açıldıysa işlemi kes
        if (tabId && activeTranslationTasks[tabId] !== taskId) {
            logTerminal(`[YT-Sub] Çeviri işlemi iptal edildi (Yeni video açıldı).`);
            break;
        }

        const payload = payloads[i];
        
        let success = false;
        let attempts = 0;
        let chunkTranslated = "";
        const maxAttempts = retryEnabled ? 3 : 1;

        while (!success && attempts < maxAttempts) {
            attempts++;
            try {
                logTerminal(`[YT-Sub] Çevriliyor: Parça ${i + 1}/${payloads.length} (Deneme ${attempts})`);
                
                if (isDeepL) {
                    // DeepL doğrudan metin arrayi alır
                    const textsToTranslate = payload.map(p => `[${p[0]}]\n${p[1]}`); // Send with ID to prevent shift
                    
                    console.groupCollapsed(`%c[DeepL GİDEN SAF VERİ (İLK 10) - Parça ${i+1}]`, "color: #10b981; font-weight: bold;");
                    textsToTranslate.slice(0, 10).forEach(t => console.log(`%c${t}`, "color: #10b981;"));
                    if (textsToTranslate.length > 10) console.log("%c... (Tüm veri DeepL'e iletildi)", "color: #10b981;");
                    console.groupEnd();

                    const translatedArray = await translateWithDeepL({
                        apiKey: activeApiKey,
                        model,
                        texts: textsToTranslate,
                        sourceLang: settings.deeplSource || "auto",
                        targetLang: settings.deeplTarget || "tr"
                    });
                    chunkTranslated = translatedArray.join("\n\n");

                    console.groupCollapsed(`%c[DeepL GELEN SAF YANIT (İLK 10) - Parça ${i+1}]`, "color: #3b82f6; font-weight: bold;");
                    translatedArray.slice(0, 10).forEach(t => console.log(`%c${t}`, "color: #3b82f6;"));
                    if (translatedArray.length > 10) console.log("%c... (Tüm yanıt işleniyor)", "color: #3b82f6;");
                    console.groupEnd();

                } else {
                    // Gemini/Groq Prompt alır
                    const prompt = YoutubeEngine.getPrompt(payload, "GEMINI", engineSettings);
                    
                    console.groupCollapsed(`%c[AI GİDEN TAM PROMPT VE SAF VERİ - Parça ${i+1}]`, "color: #10b981; font-weight: bold;");
                    const promptParts = prompt.split("### DATA START ###");
                    console.log(`%c${promptParts[0] ? promptParts[0].trim() : prompt}`, "color: #10b981;");
                    if (promptParts.length > 1) {
                        console.log("%c\n### DATA START ###", "color: #10b981; font-weight: bold;");
                        payload.slice(0, 10).forEach(p => console.log(`%c[${p[0]}]\n${p[1]}`, "color: #10b981;"));
                        if (payload.length > 10) console.log("%c... (Tüm veri AI'ya iletildi)", "color: #10b981;");
                    }
                    console.groupEnd();

                    chunkTranslated = await translateWithGemini({ apiKey: activeApiKey, model, prompt });

                    console.groupCollapsed(`%c[AI GELEN SAF YANIT (İLK 10) - Parça ${i+1}]`, "color: #3b82f6; font-weight: bold;");
                    const blockMatches = chunkTranslated.match(/\[\d+\][\s\S]*?(?=\[\d+\]|$)/g);
                    if (blockMatches) {
                        blockMatches.slice(0, 10).forEach(block => console.log(`%c${block.trim()}`, "color: #3b82f6;"));
                        if (blockMatches.length > 10) console.log("%c... (Tüm yanıt işleniyor)", "color: #3b82f6;");
                    } else {
                        console.log(`%c${chunkTranslated.substring(0, 1000)}...`, "color: #3b82f6;");
                    }
                    console.groupEnd();
                }

                success = true;
            } catch (err) {
                if (attempts >= maxAttempts) {
                    logTerminal(`[HATA] Parça ${i + 1} çevrilemedi: ${err.message}`);
                    throw err; 
                }
                logTerminal(`[UYARI] Çeviri hatası, tekrar deneniyor... (${attempts}/${maxAttempts})`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        allTranslatedText += "\n\n" + chunkTranslated;

        // Her chunk çevrildiğinde ara sonuçları sayfaya gönder
        const partialSubtitles = YoutubeEngine.rebuild(allTranslatedText, metadata);
        if (tabId) {
            chrome.tabs.sendMessage(tabId, {
                type: "TRANSLATION_RESULT",
                original: blocks,
                translatedJson: JSON.stringify(partialSubtitles),
                lang: engineSettings.translationMode,
                model
            }).catch(() => {});
        }
    }
    // Eğer döngü iptal edildiyse işlemi tamamen durdur
    if (tabId && activeTranslationTasks[tabId] !== taskId) {
        logTerminal(`[YT-Sub] İptal edilen işlem için sayfa güncellemesi yapılmıyor.`);
        return { success: false, reason: "cancelled" };
    }

    logTerminal(`[YT-Sub] Tüm parçalar başarıyla çevrildi.`);

    // 4. Yeniden oluştur (Rebuild)
    logTerminal(`[YT-Sub] Orijinal formata dönüştürülüyor (Rebuild)...`);
    const finalSubtitles = YoutubeEngine.rebuild(allTranslatedText, metadata);

    // 5. Sonucu tab'a gönder
    if (tabId) {
        chrome.tabs.sendMessage(tabId, {
            type: "TRANSLATION_RESULT",
            original: blocks,
            translatedJson: JSON.stringify(finalSubtitles),
            lang: engineSettings.translationMode,
            model
        });
    }

    logTerminal("[BAŞARILI] Çeviri işlemi tamamlandı ve sayfaya gönderildi.");

    return {
        success: true,
        subtitleCount: blocks.length
    };
}