import { GoogleGenerativeAI } from '@google/generative-ai';

const VOICE_PROMPT = `You are a business data extraction AI for a shopkeeper application (HACQUIRE).
Analyze the provided transcript of a voice recording. The user is a shopkeeper dictating a transaction or business event.
Extract the meaning into a human-readable interpretation AND a structured transaction object according to the schema.

Rules:
1. "interpretation" MUST be a natural-language sentence of what the user meant (e.g. "Bought 20 Lays chips from Swadesh Dutta for ₹400.").
2. "transaction" MUST follow the application's transaction schema.
3. Determine transaction type (SALE, PURCHASE, PAYMENT, EXPENSE, etc.).
4. Do NOT hallucinate information. If the price isn't spoken, it's null/0. If the party isn't spoken, it's "Unknown Party".
5. Return strictly structured JSON. NO Markdown wrapping.

Schema:
{
  "interpretation": "String",
  "transaction": {
    "partyName": "String",
    "transactionType": "SALE | PURCHASE | PAYMENT | EXPENSE",
    "direction": "IN | OUT",
    "amount": "Number",
    "items": [
      {
        "name": "String",
        "quantity": "Number",
        "unitPrice": "Number",
        "total": "Number"
      }
    ]
  }
}
`;

export class VoiceService {
  constructor(geminiKey, elevenLabsKey) {
    this.geminiKey = geminiKey;
    this.elevenLabsKey = elevenLabsKey;
  }

  async transcribeAudio(audioBlob) {
    if (!this.elevenLabsKey) throw new Error("ElevenLabs API Key is required");

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model_id', 'scribe_v2');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': this.elevenLabsKey
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ElevenLabs Error: ${response.status} ${err}`);
    }

    const data = await response.json();
    return data.text;
  }

  async interpretTransaction(transcript) {
    if (!this.geminiKey) throw new Error("Gemini API Key is required");

    const genAI = new GoogleGenerativeAI(this.geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      VOICE_PROMPT,
      `Transcript: "${transcript}"`
    ]);

    let responseText = result.response.text();
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(responseText);
    } catch (e) {
      throw new Error("Failed to extract structured business data.");
    }
  }
}
