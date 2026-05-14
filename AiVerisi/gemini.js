// ===========================================================
// AiVerisi/gemini.js
// Google Gemini API istemcisi
// ===========================================================

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Gemini API ile çeviri yapar
 * @param {object} options
 * @param {string} options.apiKey     - Gemini API anahtarı
 * @param {string} options.model      - Model adı (ör: gemini-2.5-flash)
 * @param {string} options.systemPrompt - Sistem promptu
 * @param {string} options.userPrompt   - Kullanıcı promptu (altyazı + dil)
 * @returns {Promise<string>} Çevrilmiş metin
 */
export async function translateWithGemini({ apiKey, model, prompt }) {
    if (!apiKey) {
        throw new Error("API anahtarı ayarlanmamış. Popup'tan API Key girin.");
    }

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [{
            role: "user",
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            maxOutputTokens: 8192,
        }
    };

    console.log(`[YT-Sub] Gemini API çağrılıyor: ${model}`);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || response.statusText;
        throw new Error(`Gemini API hatası (${response.status}): ${msg}`);
    }

    const data = await response.json();

    // Yanıttan metni çıkar
    const candidate = data.candidates?.[0];
    if (!candidate) {
        throw new Error("Gemini API boş yanıt döndü");
    }

    const text = candidate.content?.parts
        ?.map(p => p.text || "")
        .join("")
        .trim();

    if (!text) {
        throw new Error("Gemini API yanıtında metin bulunamadı");
    }

    console.log(`[YT-Sub] Çeviri tamamlandı (${text.length} karakter)`);
    return text;
}
