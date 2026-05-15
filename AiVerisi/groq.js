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

    const cleanApiKey = apiKey.trim();

    // API anahtarının önekine göre doğru sunucuyu seç:
    //   gsk_  → Groq
    //   sk-or- → OpenRouter
    //   Diğer → model isminde '/' varsa OpenRouter, yoksa Groq
    let isOpenRouter;
    if (cleanApiKey.startsWith("gsk_")) {
        isOpenRouter = false;
    } else if (cleanApiKey.startsWith("sk-or-")) {
        isOpenRouter = true;
    } else {
        isOpenRouter = model.includes("/");
    }

    const endpoint = isOpenRouter 
        ? "https://openrouter.ai/api/v1/chat/completions" 
        : "https://api.groq.com/openai/v1/chat/completions";

    // Groq/Llama modeller system+user ayrımına ihtiyaç duyar
    // Promptu "### DATA START ###" üzerinden böl
    const dataSplit = prompt.split("### DATA START ###");
    const systemContent = dataSplit[0].trim();
    const dataContent = dataSplit.length > 1 ? dataSplit[1].trim() : prompt;

    const body = {
        model: model,
        messages: [
            {
                role: "system",
                content: systemContent
            },
            {
                role: "user",
                content: "### DATA START ###\n" + dataContent
            }
        ],
        temperature: 0.3,
        top_p: 0.8
    };

    console.log(`[YT-Sub] API Key kontrol: ${cleanApiKey.length} karakter`);
    console.log(`[YT-Sub] API Key tipi: ${cleanApiKey.startsWith("gsk_") ? "GROQ" : (cleanApiKey.startsWith("sk-or-") ? "OPENROUTER" : "BİLİNMİYOR")}`);

    const fetchOptions = {
        method: "POST",
        credentials: "omit",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + cleanApiKey
        },
        body: JSON.stringify(body)
    };

    if (isOpenRouter) {
        fetchOptions.headers["HTTP-Referer"] = "https://github.com/yt-subtitle-ai";
        fetchOptions.headers["X-Title"] = "YT Subtitle AI";
    }

    console.log(`[YT-Sub] ${isOpenRouter ? 'OpenRouter' : 'Groq'} API çağrılıyor: ${model}`);

    const response = await fetch(endpoint, fetchOptions);

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
