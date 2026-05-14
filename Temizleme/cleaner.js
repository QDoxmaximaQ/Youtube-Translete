import { YoutubePrompts } from '../AiVerisi/prompts.js';

export class YoutubeEngine {
  /**
   * Ham YouTube altyazı JSON'unu ayrıştırır
   * @param {string} rawText 
   */
  static parseBlocks(rawText) {
    try {
      const data = JSON.parse(rawText);
      if (!data.events) return [];

      const blocks = [];
      let index = 1;

      for (const event of data.events) {
        if (!event.segs) continue;

        const text = event.segs
          .map(s => s.utf8 || "")
          .join("")
          .replace(/\n/g, ' ')
          .trim();

        if (!text) continue;

        blocks.push([
          index,
          (event.tStartMs || 0),
          (event.dDurationMs || 0),
          text
        ]);

        index++;
      }
      return blocks;
    } catch (e) {
      console.error("[YT-Sub] JSON parse hatası:", e);
      return [];
    }
  }

  /**
   * Blokları AI için hazır hale getirir ve Chunk'lara böler
   */
  static preparePayload(blocks, chunkSize = 400) {
    const payloads = [];
    let currentPayload = [];
    const metadata = {};

    blocks.forEach((item) => {
      const [idxVal, tStartMs, dDurationMs, cleanText] = item;
      
      currentPayload.push([idxVal, cleanText]);
      if (currentPayload.length >= chunkSize) {
         payloads.push(currentPayload);
         currentPayload = [];
      }

      metadata[idxVal.toString()] = { 
        idx: idxVal, 
        start: tStartMs,
        duration: dDurationMs,
        orig: cleanText
      };
    });
    
    if (currentPayload.length > 0) {
        payloads.push(currentPayload);
    }
    
    return { payloads, metadata };
  }

  /**
   * AI Promptu hazırlar
   */
  static getPrompt(payload, engineType = "GEMINI", settings) {
    return YoutubePrompts.generate(payload, settings, engineType);
  }

  /**
   * AI'dan gelen sonucu orijinal formata bağlar
   */
  static rebuild(aiText, metadata) {
    const blockRegex = /\[(\d+)\]\s*([\s\S]*?)(?=\s*\[\d+\]|$)/g;
    const mapping = {};
    let match;

    while ((match = blockRegex.exec(aiText)) !== null) {
      mapping[match[1]] = match[2].trim();
    }

    const outputEvents = [];
    const sortedKeys = Object.keys(metadata).sort((a, b) => Number(a) - Number(b));

    sortedKeys.forEach((key) => {
      const data = metadata[key];
      if (data) {
        const translatedText = mapping[key] || data.orig || "";
        
        outputEvents.push({
          tStartMs: data.start,
          dDurationMs: data.duration,
          segs: [{ utf8: translatedText }]
        });
      }
    });

    return { events: outputEvents };
  }
}
