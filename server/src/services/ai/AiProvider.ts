export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProvider {
  classifyProblem(input: string): Promise<{ category: string; severity: string; confidence: number }>;
  generateResponse(messages: AiMessage[], state?: Record<string, any>): Promise<{ content: string; confidence: number; state?: Record<string, any> }>;
}
