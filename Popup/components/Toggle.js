import { storage } from '../storage.js';

export function initToggle(initialState) {
    const toggleBtn = document.getElementById("toggleBtn");
    const toggleThumb = document.getElementById("toggleThumb");
    const statusDot = document.getElementById("statusDot");
    const statusText = document.getElementById("statusText");

    function setToggleUI(active) {
        const track = toggleBtn.querySelector(".toggle-track");
        if (active) {
            track.classList.add("active");
            toggleThumb.classList.add("active");
            statusDot.classList.add("active");
            statusText.classList.add("active");
            statusText.textContent = "Aktif";
        } else {
            track.classList.remove("active");
            toggleThumb.classList.remove("active");
            statusDot.classList.remove("active");
            statusText.classList.remove("active");
            statusText.textContent = "Pasif";
        }
    }

    setToggleUI(initialState);

    toggleBtn.addEventListener("click", () => {
        const track = toggleBtn.querySelector(".toggle-track");
        const isActive = track.classList.contains("active");
        const newState = !isActive;

        setToggleUI(newState);
        storage.set({ isActive: newState });
    });
}
