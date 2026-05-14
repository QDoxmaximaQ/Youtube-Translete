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
window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== "YT_SUBTITLE_RAW") return;

    console.log("[YT-Sub] Ham altyazı verisi alındı, background'a iletiliyor...");

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
            }
        }
    );
});

// ---------------------------------------------------
// Background'dan gelen sonuçları dinle
// ---------------------------------------------------
let subtitleObserver = null;
window.ytTranslatedSubtitles = [];

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRANSLATION_RESULT") {
        console.log(`[YT-Sub] Çeviri geldi (${message.lang}, ${message.model})`);
        
        try {
            const parsed = JSON.parse(message.translatedJson);
            window.ytTranslatedSubtitles = parsed.events || [];
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

    // 1. Orijinal altyazıları tamamen gizle
    let styleEl = document.getElementById("yt-ai-subtitle-style");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "yt-ai-subtitle-style";
        styleEl.textContent = `
            .ytp-caption-window-container { display: none !important; }
            .yt-ai-subtitle-container {
                position: absolute;
                bottom: 8%;
                width: 100%;
                text-align: center;
                pointer-events: none;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                transition: opacity 0.1s ease-in-out;
            }
            .yt-ai-subtitle-line {
                background: rgba(8, 8, 8, 0.75);
                color: #ffffff;
                font-family: "YouTube Noto", Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, PT Sans Caption, sans-serif;
                font-size: clamp(16px, 2.5vmin, 32px);
                padding: 4px 8px;
                border-radius: 2px;
                line-height: normal;
                text-shadow: 0px 0px 2px rgba(0,0,0,0.5);
                white-space: pre-wrap;
                display: inline-block;
            }
        `;
        document.head.appendChild(styleEl);
    }

    // 2. Kendi altyazı alanımızı oluştur
    let customContainer = document.getElementById("yt-ai-subtitle-container");
    if (!customContainer) {
        customContainer = document.createElement("div");
        customContainer.id = "yt-ai-subtitle-container";
        customContainer.className = "yt-ai-subtitle-container";
        moviePlayer.appendChild(customContainer);
    }

    // 3. Render Döngüsü (Her karede kontrol et)
    function renderSubtitles() {
        if (!video || !window.ytTranslatedSubtitles || window.ytTranslatedSubtitles.length === 0) {
            customContainer.style.opacity = "0";
            renderFrameId = requestAnimationFrame(renderSubtitles);
            return;
        }

        const currentTimeMs = video.currentTime * 1000;

        // O anki zamana denk gelen altyazıyı bul
        const activeEvent = window.ytTranslatedSubtitles.find(e => 
            currentTimeMs >= e.tStartMs && currentTimeMs <= (e.tStartMs + e.dDurationMs)
        );

        if (activeEvent && activeEvent.segs && activeEvent.segs.length > 0) {
            const newText = activeEvent.segs.map(s => s.utf8).join(" ");
            
            // Performans: Eğer metin aynıysa DOM'u yorma
            if (customContainer.dataset.currentText !== newText) {
                customContainer.innerHTML = "";
                
                // Birden fazla satır varsa (ör: \n ile ayrılmış)
                const lines = newText.split("\n");
                lines.forEach(line => {
                    if (!line.trim()) return;
                    const span = document.createElement("div");
                    span.className = "yt-ai-subtitle-line";
                    span.textContent = line;
                    customContainer.appendChild(span);
                });

                customContainer.dataset.currentText = newText;
            }
            customContainer.style.opacity = "1";
        } else {
            // Çeviri yoksa gizle
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