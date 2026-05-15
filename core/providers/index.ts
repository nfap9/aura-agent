import { OpenAIProvider } from "./openai.ts";
import { AnthropicProvider } from "./anthropic.ts";
import { GeminiProvider } from "./gemini.ts";
import type { Provider } from "./base.ts";

export type { Provider, StreamChunk } from "./base.ts";

export function createProvider(
  format: string,
  apiKey: string,
  baseURL: string,
): Provider {
  switch (format) {
    case "openai":
      return new OpenAIProvider(apiKey, baseURL);
    case "anthropic":
      return new AnthropicProvider(apiKey, baseURL);
    case "gemini":
      return new GeminiProvider(apiKey, baseURL);
    default:
      throw new Error(
        `Unsupported API format: "${format}". ` +
          `Expected "openai", "anthropic", or "gemini".`
      );
  }
}
