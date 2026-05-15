import type { Provider, StreamChunk } from "./base.ts";

export class GeminiProvider implements Provider {
  constructor(_apiKey: string, _baseURL: string) {
    // TODO: initialize Gemini SDK client
  }

  async *chatStream(): AsyncGenerator<StreamChunk> {
    throw new Error("Gemini provider is not implemented yet");
  }
}
