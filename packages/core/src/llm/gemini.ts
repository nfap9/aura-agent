import type { Provider, StreamChunk } from "./base.js";

export class GeminiProvider implements Provider {
  constructor(_apiKey: string, _baseURL: string) {
    // TODO: initialize Gemini SDK client
  }

  // eslint-disable-next-line require-yield
  async *chatStream(): AsyncGenerator<StreamChunk> {
    throw new Error("Gemini provider is not implemented yet");
  }
}
