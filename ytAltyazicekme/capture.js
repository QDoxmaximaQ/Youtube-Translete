// ===========================================================
// ytAltyazicekme/capture.js
// YouTube sayfası bağlamında çalışır (inject edilir)
// Fetch ve XHR hook'larıyla altyazı JSON verisini yakalar
// ===========================================================
(() => {
    console.log("[YT-Sub] Capture hook aktif");

    const processedUrls = new Set();

    // ---------------------------------------------------
    // Ham altyazı verisini content.js'e gönder
    // ---------------------------------------------------
    function sendToContentScript(rawText, url) {
        const urlKey = url.split("?")[0];
        if (processedUrls.has(urlKey)) {
            console.log("[YT-Sub] Bu URL zaten işlendi, atlanıyor");
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

            } catch (e) {
                console.error("[YT-Sub] XHR hook hatası:", e);
            }
        }
        return originalSend.apply(this, args);
    };
})();
