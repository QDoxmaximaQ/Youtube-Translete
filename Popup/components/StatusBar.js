export function initStatusBar() {
    const statusBar = document.getElementById("statusBar");

    // Runtime mesajlarını dinle
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "TERMINAL_LOG") {
            const msg = message.message;
            if (msg.includes("[BAŞARILI]")) {
                statusBar.textContent = "SİSTEM: BAŞARILI";
                statusBar.style.color = "#00ffd5";
            } else if (msg.includes("[HATA]")) {
                statusBar.textContent = "SİSTEM: HATA";
                statusBar.style.color = "#ff4a4a";
            } else if (msg.includes("çevriliyor") || msg.includes("çağrılıyor") || msg.includes("Çevriliyor")) {
                statusBar.textContent = "SİSTEM: ÇEVRİLİYOR...";
                statusBar.style.color = "#ffb84d";
            } else if (msg.includes("ayrıştırılıyor") || msg.includes("bulundu") || msg.includes("yakalandı") || msg.includes("hazırlanıyor")) {
                statusBar.textContent = "SİSTEM: OKUNUYOR...";
                statusBar.style.color = "#3b82f6";
            } else if (msg.includes("pasif") || msg.includes("atlanıyor")) {
                statusBar.textContent = "SİSTEM: UZANTI PASİF";
                statusBar.style.color = "#ffb84d";
            }
        }
    });
}
