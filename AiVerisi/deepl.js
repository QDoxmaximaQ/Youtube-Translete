// AiVerisi/deepl.js

export async function translateWithDeepL({ apiKey, model, texts, sourceLang, targetLang }) {
    if (!apiKey) {
        throw new Error("DeepL API anahtarı ayarlanmamış.");
    }

    const isFree = model === "DeepL-Free";
    const baseUrl = isFree ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";

    // DeepL expects up to 50 texts per request, but we will assume texts is already chunked.
    const body = {
        text: texts,
        target_lang: targetLang.toUpperCase()
    };
    
    if (sourceLang && sourceLang !== "auto") {
        body.source_lang = sourceLang.toUpperCase();
    }

    const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
            "Authorization": `DeepL-Auth-Key ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DeepL API Hatası (${response.status}): ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.translations || !Array.isArray(data.translations)) {
        throw new Error("DeepL API beklenmeyen yanıt formatı döndürdü.");
    }

    return data.translations.map(t => t.text);
}
