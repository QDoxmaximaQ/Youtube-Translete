import { storage } from '../storage.js';
import { models } from '../config.js';

export function initModelSelect(initialModel) {
    const modelSelect = document.getElementById("modelSelect");
    const modelIdEl = document.getElementById("modelId");
    
    const aiContainer = document.getElementById("aiTranslationModeContainer");
    const deeplContainer = document.getElementById("deeplLanguageContainer");

    models.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        modelSelect.appendChild(opt);
    });

    function showModelId(id) {
        modelIdEl.textContent = id;
        modelIdEl.classList.add("has-model");
        
        // Model tipine göre arayüzü güncelle
        if (id.startsWith("DeepL")) {
            aiContainer.style.display = "none";
            deeplContainer.style.display = "grid"; // grid-2 sınıfı olduğu için
        } else {
            aiContainer.style.display = "flex"; // flex kullanabiliriz veya boş bırakabiliriz
            deeplContainer.style.display = "none";
        }
    }

    modelSelect.value = initialModel || models[0].id;
    showModelId(modelSelect.value);

    modelSelect.addEventListener("change", () => {
        const selectedId = modelSelect.value;
        showModelId(selectedId);
        storage.set({ selectedModel: selectedId });
    });
}
