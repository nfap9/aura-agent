import "openai/resources/chat/completions";

declare module "openai/resources/chat/completions" {
  interface ChatCompletionMessage {
    /** 推理内容（DeepSeek / 小米 mimo 等模型特有） */
    reasoning_content?: string;
  }
}
