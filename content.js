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
// YouTube Altyazılarını Ekranda Değiştirme (DOM Mutation)
// ---------------------------------------------------
function startSubtitleObserver() {
    if (subtitleObserver) {
        subtitleObserver.disconnect();
    }

    const container = document.querySelector(".ytp-caption-window-container") || document.getElementById("movie_player");
    if (!container) {
        // Container henüz yüklenmemişse biraz bekle ve tekrar dene
        setTimeout(startSubtitleObserver, 1000);
        return;
    }

    const video = document.querySelector("video");

    subtitleObserver = new MutationObserver(() => {
        if (!video || !window.ytTranslatedSubtitles || window.ytTranslatedSubtitles.length === 0) return;

        const segments = document.querySelectorAll(".ytp-caption-segment");
        if (!segments.length) return;

        const currentTimeMs = video.currentTime * 1000;

        // Ekranda gösterilmesi gereken aktif çeviri bloğunu bul (zaman bazlı)
        // YouTube'un render gecikmelerini tolere etmek için +/- 200ms esneklik payı
        const activeEvent = window.ytTranslatedSubtitles.find(e => 
            currentTimeMs >= (e.tStartMs - 200) && currentTimeMs <= (e.tStartMs + e.dDurationMs + 200)
        );

        if (activeEvent && activeEvent.segs && activeEvent.segs.length > 0) {
            const newText = activeEvent.segs.map(s => s.utf8).join(" ");
            
            // Eğer ilk segmentin yazısı zaten yeni metinse tekrar değiştirme (performans)
            if (segments[0].textContent !== newText && segments[0].dataset.ytSubTranslated !== newText) {
                // Orijinal görünümü (renk, arka plan vb.) bozmamak için metni ilk segmente koyuyoruz
                segments[0].textContent = newText;
                segments[0].dataset.ytSubTranslated = newText; // İşaretle
                
                // Birden fazla satır/segment varsa diğerlerini boşalt (çakışmayı önle)
                for (let i = 1; i < segments.length; i++) {
                    segments[i].textContent = "";
                }
            }
        }
    });

    // Sadece altyazı alanındaki değişiklikleri dinle
    subtitleObserver.observe(container, {
        childList: true,
        subtree: true,
        characterData: true
    });
    
    console.log("[YT-Sub] Altyazı eşleyici başlatıldı.");
}