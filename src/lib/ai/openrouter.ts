import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

export function getOpenRouterClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENROUTER_API_KEY || "";
  
  if (!openaiInstance || apiKey) {
    openaiInstance = new OpenAI({
      apiKey: key,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://clinicabianca.com",
        "X-Title": "CRM Clinica Dental Bianca",
      },
    });
  }
  
  return openaiInstance;
}
