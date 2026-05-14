import { storage } from '../storage.js';
import { languages } from '../config.js';

export function initLangSelect(initialLang) {
    const langSelect = document.getElementById("langSelect");

    languages.forEach((l) => {
        const opt = document.createElement("option");
        opt.value = l.code;
        opt.textContent = l.name;
        langSelect.appendChild(opt);
    });

    langSelect.value = initialLang || "tr";

    langSelect.addEventListener("change", () => {
        storage.set({ targetLang: langSelect.value });
    });
}
