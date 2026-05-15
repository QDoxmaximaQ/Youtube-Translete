// ===========================================================
// AiVerisi/groq.js
// Groq / OpenRouter API istemcisi
// ===========================================================

/**
 * Groq veya OpenRouter API ile çeviri yapar
 * @param {object} options
 * @param {string} options.apiKey     - Groq/OpenRouter API anahtarı
 * @param {string} options.model      - Model adı (ör: llama-3.3-70b-versatile veya meta-llama/...)
 * @param {string} options.prompt     - Kullanıcı promptu (altyazı + dil)
 * @returns {Promise<string>} Çevrilmiş metin
 */
export async function translateWithGroq({ apiKey, model, prompt }) {
    if (!apiKey) {
        throw new Error("Groq/OpenRouter API anahtarı ayarlanmamış. Popup'tan API Key girin.");
    }

    // Model isminde '/' varsa OpenRouter, yoksa Groq kullanıyoruz.
    const isOpenRouter = model.includes("/");
    const endpoint = isOpenRouter 
        ? "https://openrouter.ai/api/v1/chat/completions" 
        : "https://api.groq.com/openai/v1/chat/completions";

    const body = {
        model: model,
        messages: [{
            role: "user",
            content: prompt
        }],
        temperature: 0.3,
        top_p: 0.8
    };

    const cleanApiKey = apiKey.trim();
    console.log(`[YT-Sub] API Key kontrol: ${cleanApiKey.length} karakter`);

    const headers = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cleanApiKey}`
    };

    // Chrome Eklenti ortamında özel HTTP başlıkları (HTTP-Referer vb.) 
    // bazen Authorization başlığının silinmesine veya CORS hatalarına yol açar.
    // Bu yüzden sadece gerekli olanları gönderiyoruz.

    console.log(`[YT-Sub] ${isOpenRouter ? 'OpenRouter' : 'Groq'} API çağrılıyor: ${model}`);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || response.statusText;
        throw new Error(`${isOpenRouter ? 'OpenRouter' : 'Groq'} API hatası (${response.status}): ${msg}`);
    }

    const data = await response.json();

    const choice = data.choices?.[0];
    if (!choice || !choice.message || !choice.message.content) {
        throw new Error(`${isOpenRouter ? 'OpenRouter' : 'Groq'} API boş yanıt döndü`);
    }

    const text = choice.message.content.trim();

    if (!text) {
        throw new Error(`${isOpenRouter ? 'OpenRouter' : 'Groq'} API yanıtında metin bulunamadı`);
    }

    console.log(`[YT-Sub] Çeviri tamamlandı (${text.length} karakter)`);
    return text;
}
