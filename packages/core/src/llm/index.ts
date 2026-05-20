import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import type { Provider } from "./base.js";

export type { Provider, StreamChunk } from "./base.js";

export function createProvider(format: string, apiKey: string, baseURL: string): Provider {
  switch (format) {
    case "openai":
      return new OpenAIProvider(apiKey, baseURL);
    case "anthropic":
      return new AnthropicProvider(apiKey, baseURL);
    case "gemini":
      return new GeminiProvider(apiKey, baseURL);
    default:
      throw new Error(
        `Unsupported API format: "${format}". ` + `Expected "openai", "anthropic", or "gemini".`
      );
  }
}
