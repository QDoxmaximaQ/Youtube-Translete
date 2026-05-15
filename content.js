console.log("[YT-Sub] Content script başladı");

// ---------------------------------------------------
// capture.js'i sayfa bağlamına enjekte et
// ---------------------------------------------------
const script = document.createElement("script");
script.src = chrome.runtime.getURL("ytAltyazicekme/capture.js");
script.onload = () => {
    console.log("[YT-Sub] capture.js yüklendi");
    script.remove();
};
(document.head || document.documentElement).appendChild(script);

// ---------------------------------------------------
// Sayfadan gelen ham altyazı verisini background'a ilet
// ---------------------------------------------------
let subtitleObserver = null;
window.ytTranslatedSubtitles = [];
window.ytHasTranslation = false;

window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== "YT_SUBTITLE_RAW") return;

    console.log("[YT-Sub] Ham altyazı verisi alındı, background'a iletiliyor...");

    // Hızlıca orijinal altyazıları custom player için ayarla (çeviri gelene kadar veya çeviri kapalıysa)
    try {
        const parsed = JSON.parse(event.data.rawText);
        if (parsed.events) {
            window.ytHasTranslation = false;
            window.ytTranslatedSubtitles = parsed.events; // Orijinali ata
            applyBetterTiming(parsed.events); // Hızlıca işle
            startSubtitleObserver(); // Player'ı hemen çalıştır
        }
    } catch(e) {}

    try {
        chrome.runtime.sendMessage(
            {
                type: "SUBTITLE_CAPTURED",
                rawText: event.data.rawText,
                sourceUrl: event.data.sourceUrl
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[YT-Sub] Background iletişim hatası:", chrome.runtime.lastError.message);
                    return;
                }
                if (response?.success) {
                    console.log("[YT-Sub] İşlem tamamlandı:", response.data);
                } else if (response?.error) {
                    console.error("[YT-Sub] İşlem hatası:", response.error);
                } else if (response?.skipped) {
                    console.log("[YT-Sub] Çeviri kapalı, sadece Custom Player orijinal altyazılarla çalışıyor.");
                }
            }
        );
    } catch (err) {
        console.error("[YT-Sub] Eklenti bağlantısı koptu (Muhtemelen eklentiyi yenilediniz). Lütfen sayfayı yenileyin.", err.message);
    }
});

// ---------------------------------------------------
// Sayfa değişimlerini (SPA) algıla ve altyazıları sıfırla
// ---------------------------------------------------
window.addEventListener("yt-navigate-start", () => {
    console.log("[YT-Sub] Video değişiyor, eski altyazılar sıfırlanıyor...");
    window.ytProcessedSubtitles = [];
    window.ytTranslatedSubtitles = [];
    window.ytHasTranslation = false;
    sessionStorage.removeItem('yt_ai_translation');
    
    const container = document.getElementById("yt-ai-subtitle-container");
    if (container) {
        container.innerHTML = "";
    }
    
    try {
        chrome.runtime.sendMessage({ type: "VIDEO_CHANGED" }).catch(() => {});
    } catch (err) {
        console.warn("[YT-Sub] Eklenti bağlantısı koptu. Lütfen sayfayı yenileyin.");
    }
});

const pendingMessages = {
    "tr": "[AI Çevirisi Bekleniyor... Lütfen Bekleyin]",
    "en": "[AI Translation Pending... Please Wait]",
    "ru": "[Ожидание перевода ИИ... Пожалуйста, подождите]",
    "ja": "[AI翻訳保留中... お待ちください]",
    "de": "[KI-Übersetzung ausstehend... Bitte warten]",
    "fr": "[Traduction IA en attente... Veuillez patienter]",
    "es": "[Traducción de IA pendiente... Por favor espere]"
};

function getPendingMessage(langCode) {
    const shortCode = (langCode || "en").toLowerCase().split("-")[0];
    return pendingMessages[shortCode] || pendingMessages["en"];
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRANSLATION_STARTED") {
        const msgText = getPendingMessage(message.lang);
        const pendingJson = JSON.stringify({ 
            events: [{ tStartMs: 0, dDurationMs: 60000, segs: [{ utf8: msgText }] }] 
        });

        if (!currentSettings.playerActive) {
            sessionStorage.setItem('yt_ai_translation', pendingJson);
            window.postMessage({ type: "YT_RELOAD_CAPTIONS" }, "*");
        } else {
            const parsed = JSON.parse(pendingJson);
            window.ytTranslatedSubtitles = parsed.events || [];
            window.ytHasTranslation = false;
            applyBetterTiming(window.ytTranslatedSubtitles);
            startSubtitleObserver();
        }
    }

    if (message.type === "TRANSLATION_RESULT") {
        console.log(`[YT-Sub] Çeviri geldi (${message.lang}, ${message.model})`);
        
        try {
            const parsed = JSON.parse(message.translatedJson);
            window.ytTranslatedSubtitles = parsed.events || [];
            window.ytHasTranslation = true;
            
            // Native mode aktifse: Session Storage'a yazıp Youtube'u reload et
            if (!currentSettings.playerActive) {
                sessionStorage.setItem('yt_ai_translation', message.translatedJson);
                window.postMessage({ type: "YT_RELOAD_CAPTIONS" }, "*");
            }

            applyBetterTiming(window.ytTranslatedSubtitles);
            startSubtitleObserver();
        } catch (e) {
            console.error("[YT-Sub] Çeviri JSON parse hatası:", e);
        }
    }

    if (message.type === "TRANSLATION_ERROR") {
        console.warn("[YT-Sub] Hata:", message.error);
    }
});

// ---------------------------------------------------
// YouTube Altyazılarını Ekranda Değiştirme (Custom Overlay)
// ---------------------------------------------------
let renderFrameId = null;
let currentSettings = {
    playerActive: true,
    playerFontFamily: '"YouTube Noto", Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, PT Sans Caption, sans-serif',
    playerFontSize: 24,
    playerTextColor: "#ffffff",
    playerBgColor: "#080808",
    playerBgOpacity: 75,
    playerLineGap: 4,
    playerPosX: null,
    playerPosY: null
};

window.ytProcessedSubtitles = [];

function applyBetterTiming(events) {
    if (!events || events.length === 0) {
        window.ytProcessedSubtitles = events || [];
        return;
    }
    
    // Orijinal veriyi bozmamak için derin kopya
    const newEvents = JSON.parse(JSON.stringify(events));
    newEvents.sort((a, b) => a.tStartMs - b.tStartMs);
    
    // Gölge (shadow) kopyaları ve tam tekrar eden ASR hatalarını filtrele
    const filteredEvents = [];
    let lastTextForFilter = "";
    
    for (const event of newEvents) {
        const text = event.segs ? event.segs.map(s => s.utf8 || "").join("").replace(/\s+/g, ' ').trim() : "";
        if (text && text === lastTextForFilter) {
            continue; // Birebir aynıysa atla
        }
        filteredEvents.push(event);
        if (text) lastTextForFilter = text;
    }
    
    for (let i = 0; i < filteredEvents.length - 1; i++) {
        const current = filteredEvents[i];
        const next = filteredEvents[i + 1];
        
        const currentEnd = current.tStartMs + current.dDurationMs;
        const nextStart = next.tStartMs;
        
        // Eğer 1. ve 2. altyazının başlangıç süreleri çok yakınsa (< 500ms)
        // Bu iki farklı kişinin konuşması da olabilir, YouTube ASR'nin kelime düzeltmesi de olabilir.
        if (Math.abs(nextStart - current.tStartMs) < 500) {
            const currentText = current.segs ? current.segs.map(s => s.utf8 || "").join("").toLowerCase().replace(/[^\w\sğüşıöç]/gi, "").trim() : "";
            const nextText = next.segs ? next.segs.map(s => s.utf8 || "").join("").toLowerCase().replace(/[^\w\sğüşıöç]/gi, "").trim() : "";
            
            // Eğer kelimelerin bir kısmı aynıysa (ASR güncellemesi), süreyi keseceğiz ki iki kere yazmasın.
            // Biri diğerini kapsıyorsa veya çok benzerse:
            if (currentText && nextText) {
                const words1 = currentText.split(/\s+/).filter(w => w);
                const words2 = nextText.split(/\s+/).filter(w => w);
                let matchCount = 0;
                words1.forEach(w => { if (words2.includes(w)) matchCount++; });
                
                const matchRatio = matchCount / Math.max(1, words1.length, words2.length);
                
                if (matchRatio < 0.5) {
                    // Benzerlik düşükse (%50'den az), demek ki iki farklı kişi.
                    continue; // Kesme işlemi yapma, üst üste binsin
                }
                // Benzerlik yüksekse, bu bir ASR tekrarıdır. continue yapmıyoruz, aşağıdaki kesme kodu çalışacak.
            } else {
                continue; // Metin yoksa da üst üste binsin
            }
        }
        
        // Eğer normal bir şekilde taşıyorsa veya çok yakınsa
        if (currentEnd >= nextStart) {
            // Eğer süre kısalığından dolayı 700ms bilinçli eklendiyse, kesmeyip üst üste binmesine izin ver
            if (current._isExtended) {
                continue;
            }
            // Mevcut altyazıyı bir sonrakinden 100ms önce bitir
            // Eğer aralık çok darsa, en az 100ms süre ver (eksiye düşmemek için)
            current.dDurationMs = Math.max(100, (nextStart - 100) - current.tStartMs);
        }
    }
    window.ytProcessedSubtitles = filteredEvents;
}

// Başlangıçta ayarları al
chrome.storage.local.get(null, (data) => {
    if (data.playerActive !== undefined) currentSettings.playerActive = data.playerActive;
    if (data.playerFontFamily) currentSettings.playerFontFamily = data.playerFontFamily;
    if (data.playerFontSize) currentSettings.playerFontSize = data.playerFontSize;
    if (data.playerTextColor) currentSettings.playerTextColor = data.playerTextColor;
    if (data.playerBgColor) currentSettings.playerBgColor = data.playerBgColor;
    if (data.playerBgOpacity !== undefined) currentSettings.playerBgOpacity = data.playerBgOpacity;
    if (data.playerLineGap !== undefined) currentSettings.playerLineGap = data.playerLineGap;
    if (data.playerPosX !== undefined) currentSettings.playerPosX = data.playerPosX;
    if (data.playerPosY !== undefined) currentSettings.playerPosY = data.playerPosY;

    sessionStorage.setItem('yt_ai_native_mode', currentSettings.playerActive ? 'false' : 'true');
});

// Ayar değişikliklerini anlık dinle
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "UPDATE_PLAYER_SETTINGS") {
        currentSettings = { ...currentSettings, ...message.settings };
        sessionStorage.setItem('yt_ai_native_mode', currentSettings.playerActive ? 'false' : 'true');
        
        updatePlayerStyles();
        // Zaman ayarı değişmişse listeyi tekrar hesapla
        if (window.ytTranslatedSubtitles) {
            applyBetterTiming(window.ytTranslatedSubtitles);
        }
    }
    if (message.type === "RESET_PLAYER_POSITION") {
        currentSettings.playerPosX = null;
        currentSettings.playerPosY = null;
        const customContainer = document.getElementById("yt-ai-subtitle-container");
        if (customContainer) {
            customContainer.style.transform = `translate(0px, 0px)`;
        }
    }
});

function hexToRgba(hex, opacity) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

function updatePlayerStyles() {
    let styleEl = document.getElementById("yt-ai-subtitle-style");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "yt-ai-subtitle-style";
        document.head.appendChild(styleEl);
    }

    // Eğer player aktifse orijinali gizle, değilse göster
    const nativeDisplay = currentSettings.playerActive ? "none !important" : "block";
    const customDisplay = currentSettings.playerActive ? "flex" : "none";

    styleEl.textContent = `
        .ytp-caption-window-container { display: ${nativeDisplay}; }
        .yt-ai-subtitle-container {
            position: absolute;
            bottom: 8%;
            left: 0;
            width: 100%;
            text-align: center;
            z-index: 9999;
            display: ${customDisplay};
            flex-direction: column;
            align-items: center;
            gap: ${currentSettings.playerLineGap}px;
            transition: opacity 0.1s ease-in-out;
            cursor: grab;
            user-select: none;
        }
        .yt-ai-subtitle-container:active {
            cursor: grabbing;
        }
        .yt-ai-subtitle-line {
            background: ${hexToRgba(currentSettings.playerBgColor, currentSettings.playerBgOpacity)};
            color: ${currentSettings.playerTextColor};
            font-family: ${currentSettings.playerFontFamily};
            font-size: ${currentSettings.playerFontSize}px;
            padding: 4px 8px;
            border-radius: 4px;
            line-height: normal;
            text-shadow: 0px 0px 3px rgba(0,0,0,0.8);
            white-space: pre-wrap;
            display: inline-block;
            pointer-events: none; /* Metin seçimini engeller, sürüklemeyi kolaylaştırır */
        }
    `;

    const customContainer = document.getElementById("yt-ai-subtitle-container");
    if (customContainer && currentSettings.playerPosX !== null && currentSettings.playerPosY !== null) {
        customContainer.style.transform = `translate(${currentSettings.playerPosX}px, ${currentSettings.playerPosY}px)`;
    }
}

function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX = 0, initialY = 0;

    element.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - initialX;
        startY = e.clientY - initialY;
        element.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        initialX = e.clientX - startX;
        initialY = e.clientY - startY;
        
        element.style.transform = `translate(${initialX}px, ${initialY}px)`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'grab';
            
            // Pozisyonu kaydet
            currentSettings.playerPosX = initialX;
            currentSettings.playerPosY = initialY;
            chrome.storage.local.set({ playerPosX: initialX, playerPosY: initialY });
        }
    });

    // İlk pozisyonu yükle
    if (currentSettings.playerPosX !== null && currentSettings.playerPosY !== null) {
        initialX = currentSettings.playerPosX;
        initialY = currentSettings.playerPosY;
        element.style.transform = `translate(${initialX}px, ${initialY}px)`;
    }
}

function startSubtitleObserver() {
    if (renderFrameId) {
        cancelAnimationFrame(renderFrameId);
    }

    const moviePlayer = document.getElementById("movie_player");
    const video = document.querySelector("video");

    if (!moviePlayer || !video) {
        setTimeout(startSubtitleObserver, 1000);
        return;
    }

    updatePlayerStyles();

    let customContainer = document.getElementById("yt-ai-subtitle-container");
    if (!customContainer) {
        customContainer = document.createElement("div");
        customContainer.id = "yt-ai-subtitle-container";
        customContainer.className = "yt-ai-subtitle-container";
        moviePlayer.appendChild(customContainer);
        makeDraggable(customContainer);
    }

    function renderSubtitles() {
        if (!video || !window.ytProcessedSubtitles || window.ytProcessedSubtitles.length === 0 || !currentSettings.playerActive) {
            if (customContainer) customContainer.style.opacity = "0";
            renderFrameId = requestAnimationFrame(renderSubtitles);
            return;
        }

        const currentTimeMs = video.currentTime * 1000;

        const activeEvents = window.ytProcessedSubtitles.filter(e => 
            currentTimeMs >= e.tStartMs && currentTimeMs <= (e.tStartMs + e.dDurationMs)
        );

        if (activeEvents.length > 0) {
            // Ham metinleri topla
            let allLines = [];
            activeEvents.forEach(ev => {
                const text = ev.segs ? ev.segs.map(s => s.utf8).join(" ") : "";
                if (text.trim() !== "") {
                    // Satır içi \n varsa böl
                    allLines.push(...text.split("\n").map(l => l.trim()).filter(l => l !== ""));
                }
            });

            // Tekrarlanan (aynı olan) altyazıları temizle (ASR hatalarını engellemek için)
            const uniqueLines = [...new Set(allLines)];
            const newText = uniqueLines.join("\n");
            
            if (customContainer.dataset.currentText !== newText) {
                customContainer.innerHTML = "";
                
                uniqueLines.forEach(line => {
                    const span = document.createElement("div");
                    span.className = "yt-ai-subtitle-line";
                    span.textContent = line;
                    customContainer.appendChild(span);
                });

                customContainer.dataset.currentText = newText;
            }
            customContainer.style.opacity = "1";
        } else {
            if (customContainer.style.opacity !== "0") {
                customContainer.style.opacity = "0";
                customContainer.dataset.currentText = "";
            }
        }

        renderFrameId = requestAnimationFrame(renderSubtitles);
    }

    renderSubtitles();
    console.log("[YT-Sub] Özel altyazı motoru başlatıldı.");
}