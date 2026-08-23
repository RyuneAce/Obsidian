import { GoogleGenerativeAI } from '@google/generative-ai';

export class AiChatService {
  constructor(geminiKey) {
    this.geminiKey = geminiKey;
    this.history = []; // ephemeral conversation history per session
  }

  async askQuestion(question, deterministicData) {
    if (!this.geminiKey) {
       throw new Error("Gemini API key is missing. Please configure it in Voice Commerce or Scanner settings first.");
    }
    
    if (!navigator.onLine) {
       throw new Error("Internet connection required. AI Insights needs an internet connection to analyze your business data.");
    }

    try {
      const genAI = new GoogleGenerativeAI(this.geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Build system prompt and context
      const systemPrompt = `You are AI Insights, an intelligent business analytical layer for a shop.
Your job is to answer the user's questions about their business using ONLY the provided deterministic JSON data below.
DO NOT invent financial numbers, transaction totals, or inventory counts.
Do not fabricate a prediction if there is not enough historical data.
Keep your answers concise, business-focused, and helpful. Use simple formatting.
You have access to the conversation history to maintain context.

=== REAL BUSINESS DATA JSON (Do not invent outside this) ===
${JSON.stringify(deterministicData, null, 2)}
============================================================
`;
      
      const chatHistory = this.history.map(msg => ({
         role: msg.role === 'user' ? 'user' : 'model',
         parts: [{ text: msg.text }]
      }));

      const chatSession = model.startChat({
         history: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'Understood. I will strictly use the provided data.' }] },
            ...chatHistory
         ]
      });

      const result = await chatSession.sendMessage(question);
      const answer = result.response.text();

      // Add user message to local history only after successful API response
      this.history.push({ role: 'user', text: question });
      // Add AI response to local history
      this.history.push({ role: 'ai', text: answer });
      
      return answer;
    } catch (err) {
       console.error("AI Insights Error:", err);
       throw new Error("Failed to communicate with AI Insights. Please check your connection or API key.");
    }
  }

  clearHistory() {
      this.history = [];
  }
}
