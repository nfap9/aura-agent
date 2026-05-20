import type { Provider, StreamChunk } from "./base.js";

export class AnthropicProvider implements Provider {
  constructor(_apiKey: string, _baseURL: string) {
    // TODO: initialize Anthropic SDK client
  }

  // eslint-disable-next-line require-yield
  async *chatStream(): AsyncGenerator<StreamChunk> {
    throw new Error("Anthropic provider is not implemented yet");
  }
}
