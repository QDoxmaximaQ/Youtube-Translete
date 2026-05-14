import { storage } from '../storage.js';

export function initPlayerConfig(settings) {
    const toggleBtn = document.getElementById("playerToggleBtn");
    const track = document.getElementById("playerToggleTrack");
    const thumb = document.getElementById("playerToggleThumb");
    const toggleText = document.getElementById("playerToggleText");

    const fontSelect = document.getElementById("playerFontFamily");
    const sizeInput = document.getElementById("playerFontSize");
    const textColor = document.getElementById("playerTextColor");
    const bgColor = document.getElementById("playerBgColor");
    const bgOpacity = document.getElementById("playerBgOpacity");
    const resetBtn = document.getElementById("playerResetPosBtn");

    let isPlayerActive = settings.playerActive !== false; // varsayılan true
    
    function updateToggleUI(active) {
        if (active) {
            track.classList.add("active");
            thumb.classList.add("active");
            toggleText.textContent = "AÇIK";
            toggleText.style.color = "#00ffd5";
        } else {
            track.classList.remove("active");
            thumb.classList.remove("active");
            toggleText.textContent = "KAPALI";
            toggleText.style.color = "rgba(255,255,255,0.4)";
        }
    }

    updateToggleUI(isPlayerActive);

    toggleBtn.addEventListener("click", () => {
        isPlayerActive = !isPlayerActive;
        updateToggleUI(isPlayerActive);
        saveSettings();
    });

    // Varsayılan atamalar
    if (settings.playerFontFamily) fontSelect.value = settings.playerFontFamily;
    if (settings.playerFontSize) sizeInput.value = settings.playerFontSize;
    if (settings.playerTextColor) textColor.value = settings.playerTextColor;
    if (settings.playerBgColor) bgColor.value = settings.playerBgColor;
    if (settings.playerBgOpacity) bgOpacity.value = settings.playerBgOpacity;

    let timeout = null;
    const saveSettings = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const newSettings = {
                playerActive: isPlayerActive,
                playerFontFamily: fontSelect.value,
                playerFontSize: parseInt(sizeInput.value),
                playerTextColor: textColor.value,
                playerBgColor: bgColor.value,
                playerBgOpacity: parseInt(bgOpacity.value)
            };
            storage.set(newSettings);
            
            // Ayarlar değiştiğinde doğrudan youtube sayfasındaki content script'e bildir
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: "UPDATE_PLAYER_SETTINGS",
                        settings: newSettings
                    }).catch(() => {});
                }
            });
        }, 300);
    };

    fontSelect.addEventListener("change", saveSettings);
    sizeInput.addEventListener("input", saveSettings);
    textColor.addEventListener("input", saveSettings);
    bgColor.addEventListener("input", saveSettings);
    bgOpacity.addEventListener("input", saveSettings);

    resetBtn.addEventListener("click", () => {
        storage.set({ playerPosX: null, playerPosY: null });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "RESET_PLAYER_POSITION"
                }).catch(() => {});
            }
        });
        resetBtn.textContent = "SIFIRLANDI!";
        setTimeout(() => { resetBtn.textContent = "KONUMU SIFIRLA"; }, 1500);
    });
}
