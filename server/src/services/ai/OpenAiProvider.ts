import type { AiMessage, AiProvider } from "./AiProvider.js";
import { MockAiProvider } from "./MockAiProvider.js";

export interface OpenAiProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class OpenAiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly mockFallback: MockAiProvider;

  constructor(options?: string | OpenAiProviderOptions) {
    if (typeof options === "string") {
      this.apiKey = options.trim();
      this.model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
      this.baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
    } else {
      this.apiKey = (options?.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "").trim();
      this.model = options?.model?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
      this.baseUrl = (options?.baseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
    }

    this.mockFallback = new MockAiProvider();

    if (!this.apiKey) {
      console.warn("[OpenAiProvider] Warning: No OpenAI API key provided.");
    }
  }

  async classifyProblem(input: string): Promise<{ category: string; severity: string; confidence: number }> {
    if (!this.apiKey) {
      return this.mockFallback.classifyProblem(input);
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "You are an IT issue classifier. Classify the user problem into category (network, wi-fi, vpn, software, hardware, account, email, system, other) and severity (LOW, MEDIUM, HIGH, CRITICAL). Respond strictly with a JSON object: {\"category\": string, \"severity\": string, \"confidence\": number}."
            },
            {
              role: "user",
              content: input
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
      });

      if (!response.ok) {
        return this.mockFallback.classifyProblem(input);
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return this.mockFallback.classifyProblem(input);
      }

      const parsed = JSON.parse(content);
      return {
        category: typeof parsed.category === "string" ? parsed.category.toLowerCase() : "general",
        severity: typeof parsed.severity === "string" ? parsed.severity.toUpperCase() : "LOW",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85
      };
    } catch {
      return this.mockFallback.classifyProblem(input);
    }
  }

  async generateResponse(messages: AiMessage[]): Promise<{ content: string; confidence: number }> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is missing. Please set LLM_API_KEY or OPENAI_API_KEY in .env");
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        })),
        temperature: 0.7
      })
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorJson = (await response.json()) as { error?: { message?: string } };
        if (errorJson?.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // ignore json parse error
      }
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      content: content.trim(),
      confidence: 0.95
    };
  }
}
