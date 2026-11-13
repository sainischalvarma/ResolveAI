import { pipeline, env } from "@xenova/transformers";

// Disable local models loading from remote if offline is preferred, but for initial download it needs access.
// We keep default behavior.

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

let localPipelinePromise: Promise<any> | null = null;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  constructor() {
    if (!localPipelinePromise) {
      localPipelinePromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await localPipelinePromise;
    const output = await extractor!(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "").trim();
    this.baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
    if (!this.apiKey) {
      throw new Error("OpenAI API key missing for embeddings.");
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-3-small"
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI Embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}

export function resolveEmbeddingProvider(): EmbeddingProvider {
  const providerType = (process.env.EMBEDDING_PROVIDER ?? "local").toLowerCase().trim();
  
  if (providerType === "openai") {
    try {
      return new OpenAiEmbeddingProvider();
    } catch (e) {
      console.warn("Falling back to local embeddings:", e);
    }
  }
  
  return new LocalEmbeddingProvider();
}
