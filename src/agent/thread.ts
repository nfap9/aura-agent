import type { Message, Tokenizer } from "../types/types.ts";

const DEFAULT_MAX_CONTEXT_TOKENS = 128 * 1024;

export interface ThreadOptions {
  maxContextTokens?: number | undefined;
  tokenizer?: Tokenizer | undefined;
}

/**
 * 对话线程：管理消息历史、Token 估算与上下文截断
 *
 * 职责单一：只负责消息的存储、读取、裁剪和复制，不涉及模型调用或工具执行。
 */
export class Thread {
  private messages: Message[] = [];
  private maxContextTokens: number;
  private tokenizer?: Tokenizer | undefined;

  constructor(options?: ThreadOptions) {
    this.maxContextTokens = options?.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
    this.tokenizer = options?.tokenizer;
  }

  // ---------- 消息操作 ----------

  addSystemPrompt(content: string): void {
    this.messages.push({ role: "system", content });
  }

  addMessages(messages: Message[]): void {
    this.messages.push(...messages);
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  setMessages(messages: Message[]): void {
    this.messages = [...messages];
  }

  /** 清空历史，可选择保留 system prompt */
  clear(keepSystem = true): void {
    if (keepSystem && this.messages[0]?.role === "system") {
      this.messages = [this.messages[0]!];
    } else {
      this.messages = [];
    }
  }

  /** 创建独立的消息副本 */
  fork(): Thread {
    const clone = new Thread({
      maxContextTokens: this.maxContextTokens,
      tokenizer: this.tokenizer ?? undefined,
    });
    clone.setMessages(this.messages);
    return clone;
  }

  // ---------- Token 管理 ----------

  private estimateTokens(text: string): number {
    if (!text) return 0;
    if (this.tokenizer) {
      return this.tokenizer.encode(text).length;
    }
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return chineseChars + Math.ceil(otherChars / 4);
  }

  private estimateMessageTokens(msg: Message): number {
    let tokens = 4;
    tokens += this.estimateTokens(msg.content || "");
    tokens += this.estimateTokens(msg.reasoning_content || "");
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        tokens += this.estimateTokens(tc.function.name);
        tokens += this.estimateTokens(tc.function.arguments);
        tokens += 4;
      }
    }
    if (msg.role === "tool") tokens += 2;
    return tokens;
  }

  /** 按 maxContextTokens 截断历史，保留 system prompt 和最近消息 */
  trim(): void {
    let totalTokens = 0;
    for (const msg of this.messages) {
      totalTokens += this.estimateMessageTokens(msg);
    }
    if (totalTokens <= this.maxContextTokens) return;

    const startIndex = this.messages[0]?.role === "system" ? 1 : 0;
    const minKeepCount = 2;

    while (
      totalTokens > this.maxContextTokens &&
      this.messages.length - startIndex > minKeepCount
    ) {
      const removed = this.messages[startIndex]!;
      totalTokens -= this.estimateMessageTokens(removed);
      this.messages.splice(startIndex, 1);
    }
  }
}
