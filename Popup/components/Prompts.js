import { storage } from '../storage.js';

export function initCustomPrompts(geminiPrompt, groqPrompt) {
    const geminiTextArea = document.getElementById("geminiPrompt");
    const groqTextArea = document.getElementById("groqPrompt");

    if (geminiPrompt) geminiTextArea.value = geminiPrompt;
    if (groqPrompt) groqTextArea.value = groqPrompt;

    let timeout = null;
    const savePrompts = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            storage.set({ 
                geminiPrompt: geminiTextArea.value,
                groqPrompt: groqTextArea.value
            });
        }, 500);
    };

    geminiTextArea.addEventListener("input", savePrompts);
    groqTextArea.addEventListener("input", savePrompts);
}
