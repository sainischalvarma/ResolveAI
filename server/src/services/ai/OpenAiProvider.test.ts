import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAiProvider } from "./OpenAiProvider.js";

describe("OpenAiProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws an error when generateResponse is called without an API key", async () => {
    const provider = new OpenAiProvider({ apiKey: "" });
    await expect(
      provider.generateResponse([{ role: "user", content: "Hello" }])
    ).rejects.toThrow("OpenAI API key is missing");
  });

  it("generates a response using OpenAI completions endpoint", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Please check your network cable and router lights."
            }
          }
        ]
      })
    });
    globalThis.fetch = fakeFetch;

    const provider = new OpenAiProvider({ apiKey: "test-api-key" });
    const reply = await provider.generateResponse([
      { role: "user", content: "My internet is down" }
    ]);

    expect(reply.content).toBe("Please check your network cable and router lights.");
    expect(reply.confidence).toBe(0.95);
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    const callArgs = fakeFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.openai.com/v1/chat/completions");
    const reqBody = JSON.parse(callArgs[1].body);
    expect(reqBody.model).toBe("gpt-4o-mini");
    expect(reqBody.messages).toEqual([{ role: "user", content: "My internet is down" }]);
  });

  it("handles OpenAI API error responses with descriptive error messages", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({
        error: {
          message: "You have no credits remaining. Add credits to continue.",
          code: "credit_balance_exhausted"
        }
      })
    });
    globalThis.fetch = fakeFetch;

    const provider = new OpenAiProvider({ apiKey: "test-api-key" });
    await expect(
      provider.generateResponse([{ role: "user", content: "Hello" }])
    ).rejects.toThrow("You have no credits remaining");
  });

  it("classifies user problems into categories and severities", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "network",
                severity: "HIGH",
                confidence: 0.9
              })
            }
          }
        ]
      })
    });
    globalThis.fetch = fakeFetch;

    const provider = new OpenAiProvider({ apiKey: "test-api-key" });
    const classification = await provider.classifyProblem("All company routers are offline");

    expect(classification.category).toBe("network");
    expect(classification.severity).toBe("HIGH");
    expect(classification.confidence).toBe(0.9);
  });
});
