// ===========================================================
// ytAltyazicekme/capture.js
// YouTube sayfası bağlamında çalışır (inject edilir)
// Fetch ve XHR hook'larıyla altyazı JSON verisini yakalar
// ===========================================================
(() => {
    console.log("[YT-Sub] Capture hook aktif");

    const processedUrls = new Set();

    // ---------------------------------------------------
    // Sayfa bağlamında (Main World) komut dinleyici
    // ---------------------------------------------------
    window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        if (event.data && event.data.type === "YT_RELOAD_CAPTIONS") {
            const player = document.getElementById("movie_player");
            if (player && typeof player.setOption === "function") {
                const track = player.getOption("captions", "track");
                if (track) {
                    // Kısa süreliğine kapatıp açarak yeni JSON'u fetch etmesini zorla
                    player.setOption("captions", "track", {});
                    setTimeout(() => {
                        player.setOption("captions", "track", track);
                    }, 50);
                }
            }
        }
    });

    // ---------------------------------------------------
    // Ham altyazı verisini content.js'e gönder
    // ---------------------------------------------------
    function sendToContentScript(rawText, url) {
        let urlKey = url;
        try {
            const urlObj = new URL(url.startsWith("http") ? url : window.location.origin + url);
            const v = urlObj.searchParams.get("v") || "";
            const lang = urlObj.searchParams.get("lang") || "";
            urlKey = v ? (v + "_" + lang) : url.split("?")[0];
        } catch(e) {}

        if (processedUrls.has(urlKey)) {
            console.log("[YT-Sub] Bu video/dil zaten işlendi, atlanıyor:", urlKey);
            return;
        }
        processedUrls.add(urlKey);

        console.log(`[YT-Sub] Altyazı yakalandı (${rawText.length} byte)`);

        window.postMessage({
            type: "YT_SUBTITLE_RAW",
            rawText,
            sourceUrl: url
        }, "*");
    }

    // ---------------------------------------------------
    // FETCH HOOK
    // ---------------------------------------------------
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");

        // Kendi isteğimizi yapıp orijinal sonucu content.js'e gönderelim
        if (url.includes("/api/timedtext")) {
            try {
                // "tlang" parametresi varsa (Google Otomatik Çeviri), orijinal dili çekmek için parametreyi sil
                let originalUrl = url;
                if (originalUrl.includes("tlang=")) {
                    const urlObj = new URL(originalUrl.startsWith("http") ? originalUrl : window.location.origin + originalUrl);
                    urlObj.searchParams.delete("tlang");
                    originalUrl = urlObj.toString();
                }

                // Orijinal URL'yi arkaplanda fetch ile çekip sisteme (AI'ye) yolla
                originalFetch(originalUrl).then(res => res.text()).then(text => {
                    sendToContentScript(text, originalUrl);
                }).catch(e => console.error("[YT-Sub] Orijinal metin çekilemedi:", e));

                // EĞER ÖZEL OYNATICI KAPALIYSA (YOUTUBE KENDİ ALTYAZISI KULLANILACAKSA)
                const isNativeMode = sessionStorage.getItem('yt_ai_native_mode') === 'true';
                if (isNativeMode) {
                    const translation = sessionStorage.getItem('yt_ai_translation');
                    // Çeviri varsa onu dön, yoksa boş/bekleme mesajı dön
                    const mockResponse = translation || JSON.stringify({ 
                        events: [{ tStartMs: 0, dDurationMs: 15000, segs: [{ utf8: "[AI Çevirisi Hazırlanıyor... Lütfen Bekleyin]" }] }] 
                    });
                    
                    return new Response(mockResponse, {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

            } catch (e) {
                console.error("[YT-Sub] Fetch hook hatası:", e);
            }
        }

        return originalFetch.apply(this, args);
    };

    // ---------------------------------------------------
    // XHR HOOK
    // ---------------------------------------------------
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._ytSubUrl = typeof url === "string" ? url : "";
        return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        if (this._ytSubUrl && this._ytSubUrl.includes("/api/timedtext")) {
            try {
                let originalUrl = this._ytSubUrl;
                if (originalUrl.includes("tlang=")) {
                    const urlObj = new URL(originalUrl.startsWith("http") ? originalUrl : window.location.origin + originalUrl);
                    urlObj.searchParams.delete("tlang");
                    originalUrl = urlObj.toString();
                }

                originalFetch(originalUrl).then(res => res.text()).then(text => {
                    sendToContentScript(text, originalUrl);
                }).catch(e => console.error("[YT-Sub] Orijinal metin XHR ile çekilemedi:", e));

                // XHR İÇİN YOUTUBE KENDİ ALTYAZISINI EZME
                const isNativeMode = sessionStorage.getItem('yt_ai_native_mode') === 'true';
                if (isNativeMode) {
                    this.addEventListener('readystatechange', () => {
                        if (this.readyState === 4) {
                            const translation = sessionStorage.getItem('yt_ai_translation');
                            const mockResponse = translation || JSON.stringify({ 
                                events: [{ tStartMs: 0, dDurationMs: 15000, segs: [{ utf8: "[AI Çevirisi Hazırlanıyor... Lütfen Bekleyin]" }] }] 
                            });
                            Object.defineProperty(this, 'responseText', { get: () => mockResponse });
                            Object.defineProperty(this, 'response', { get: () => mockResponse });
                        }
                    });
                }

            } catch (e) {
                console.error("[YT-Sub] XHR hook hatası:", e);
            }
        }
        return originalSend.apply(this, args);
    };
})();
