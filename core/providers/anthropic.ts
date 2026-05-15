import type { Provider, StreamChunk } from "./base.ts";

export class AnthropicProvider implements Provider {
  constructor(_apiKey: string, _baseURL: string) {
    // TODO: initialize Anthropic SDK client
  }

  async *chatStream(): AsyncGenerator<StreamChunk> {
    throw new Error("Anthropic provider is not implemented yet");
  }
}
