export function initTerminal() {
    const terminalOutput = document.getElementById("terminalOutput");
    const statusBox = document.getElementById("statusBox");

    // Runtime mesajlarını dinle
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "TERMINAL_LOG") {
            const time = new Date().toLocaleTimeString('tr-TR', { hour12: false });
            const logLine = document.createElement("div");
            logLine.textContent = `[${time}] ${message.message}`;
            
            // Eğer hata ise kırmızı yap
            if (message.message.includes("[HATA]")) logLine.style.color = "#ff4a4a";
            else if (message.message.includes("[UYARI]")) logLine.style.color = "#ffb84d";
            else if (message.message.includes("[BAŞARILI]")) logLine.style.color = "#00ffd5";

            terminalOutput.appendChild(logLine);
            terminalOutput.scrollTop = terminalOutput.scrollHeight;

            if (message.message.includes("[BAŞARILI]")) {
                statusBox.textContent = "SİSTEM: BAŞARILI";
                statusBox.style.color = "#00ffd5";
            } else if (message.message.includes("[HATA]")) {
                statusBox.textContent = "SİSTEM: HATA";
                statusBox.style.color = "#ff4a4a";
            } else if (message.message.includes("çağrılıyor")) {
                statusBox.textContent = "SİSTEM: ÇEVRİLİYOR...";
                statusBox.style.color = "#ffb84d";
            }
        }
    });
}
