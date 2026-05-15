import type {
  Message,
  ToolCall,
  Tokenizer,
  ChatCompletionOptions,
  ChatEvents,
  ChatResult,
} from "./types.ts";
import type { Provider, StreamChunk } from "./providers/index.ts";
import { ToolRegistry } from "./tools/registry.ts";
import type { MemoryManager } from "./memory/manager.ts";
import type { SkillRegistry } from "./skills/index.ts";

const MAX_ITERATIONS = 10;
const DEFAULT_MAX_CONTEXT_TOKENS = 128 * 1024;

function normalizeInput(input: string | Message | Message[]): Message[] {
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }
  if (Array.isArray(input)) {
    return input;
  }
  return [input];
}

export interface ChatOptions {
  provider: Provider;
  modelName: string;
  systemPrompt?: string;
  tools?: ToolRegistry;
  maxContextTokens?: number | undefined;
  tokenizer?: Tokenizer | undefined;
  /** 长期记忆管理器，启用后自动检索和注入相关记忆 */
  memoryManager?: MemoryManager | undefined;
  /** 是否自动将对话总结为记忆 */
  autoMemory?: boolean | undefined;
  /** Skill 注册表，自动根据用户查询注入相关技能上下文 */
  skillRegistry?: SkillRegistry | undefined;
}

export default class Chat {
  private messages: Message[] = [];
  private provider: Provider;
  private tools: ToolRegistry;
  private modelName: string;
  private maxContextTokens: number;
  private tokenizer: Tokenizer | undefined;
  private memoryManager: MemoryManager | undefined;
  private autoMemory: boolean;
  private skillRegistry: SkillRegistry | undefined;

  constructor(options: ChatOptions) {
    this.provider = options.provider;
    this.modelName = options.modelName;
    this.tools = options.tools ?? new ToolRegistry();
    this.maxContextTokens = options.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
    this.tokenizer = options.tokenizer;
    this.memoryManager = options.memoryManager;
    this.autoMemory = options.autoMemory ?? false;
    this.skillRegistry = options.skillRegistry;
    if (options.systemPrompt) {
      this.messages.push({
        role: "system",
        content: options.systemPrompt,
      });
    }
  }

  // ========== Token 估算与截断 限制上下文窗口大小 ==========

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

  private trimHistory() {
    let totalTokens = 0;
    for (const msg of this.messages) {
      totalTokens += this.estimateMessageTokens(msg);
    }
    if (totalTokens <= this.maxContextTokens) return;

    let startIndex = this.messages[0]?.role === "system" ? 1 : 0;
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

  // ========== 核心对话逻辑 ==========

  private async *runLoop(
    inputMessages: Message[],
    options?: ChatCompletionOptions,
    events?: ChatEvents,
  ): AsyncGenerator<StreamChunk> {
    // 注入长期记忆到上下文
    if (this.memoryManager && inputMessages.length > 0) {
      const query = inputMessages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n");
      if (query) {
        const memoryContext = await this.memoryManager.getRelevantContext(query);
        if (memoryContext) {
          // 将记忆附加到第一条 user message 前面
          const firstUserIdx = inputMessages.findIndex((m) => m.role === "user");
          if (firstUserIdx !== -1) {
            const target = inputMessages[firstUserIdx]!;
            const original = target.content ?? "";
            inputMessages[firstUserIdx] = {
              role: target.role,
              content: `${memoryContext}\n---\n${original}`,
              ...(target.reasoning_content !== undefined ? { reasoning_content: target.reasoning_content } : {}),
              ...(target.tool_calls !== undefined ? { tool_calls: target.tool_calls } : {}),
              ...(target.tool_call_id !== undefined ? { tool_call_id: target.tool_call_id } : {}),
            };
          }
        }
      }
    }

    this.messages.push(...inputMessages);
    this.trimHistory();

    let continueLoop = true;
    let iteration = 0;

    // 提取用户查询文本（用于 skill 匹配）
    const userQuery = inputMessages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");

    while (continueLoop && iteration < MAX_ITERATIONS) {
      iteration++;
      events?.onIterationStart?.(iteration, this.messages);

      const apiMessages = this.buildMessagesWithSkills(userQuery, events);

      const stream = this.provider.chatStream({
        model: this.modelName,
        messages: apiMessages,
        tools: this.tools.getOpenAISchemas(),
        ...(options ? { options } : {}),
      });

      let content = "";
      let reasoningContent = "";
      const toolCalls: ToolCall[] = [];
      let hasToolCall = false;

      for await (const chunk of stream) {
        if (chunk.type === "content") {
          content += chunk.delta;
          events?.onContentChunk?.(chunk.delta);
          yield chunk;
        } else if (chunk.type === "reasoning") {
          reasoningContent += chunk.delta;
          events?.onReasoningChunk?.(chunk.delta);
          yield chunk;
        } else if (chunk.type === "tool_call") {
          hasToolCall = true;
          const { index, id, name, arguments: args } = chunk.toolCall!;
          if (!toolCalls[index]) {
            toolCalls[index] = {
              id: "",
              type: "function",
              function: { name: "", arguments: "" },
            };
          }
          if (id) toolCalls[index].id += id;
          if (name) toolCalls[index].function.name += name;
          if (args) toolCalls[index].function.arguments += args;
          yield chunk;
        }
      }

      const assistantMessage: Message = {
        role: "assistant",
        content,
        ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
        ...(hasToolCall ? { tool_calls: toolCalls } : {}),
      };
      this.messages.push(assistantMessage);
      events?.onIterationEnd?.(iteration, assistantMessage);

      if (!hasToolCall) {
        continueLoop = false;
      } else {
        for (const toolCall of toolCalls) {
          const { name, arguments: args } = toolCall.function;
          const parseArgs = JSON.parse(args);
          let result: string;

          events?.onToolCallStart?.(toolCall);
          try {
            result = await this.tools.execute(name, parseArgs);
            events?.onToolCallEnd?.(toolCall, result);
          } catch (err: any) {
            const error = err instanceof Error ? err : new Error(String(err));
            events?.onToolCallError?.(toolCall, error);
            result = `工具执行错误: ${error.message}`;
          }

          this.messages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
          });
        }
      }

      if (iteration >= MAX_ITERATIONS && hasToolCall) {
        const stopMsg = "\n[到达最大请求次数，已停止]";
        yield { type: "content", delta: stopMsg };
        continueLoop = false;
      }
    }
  }

  /** 流式调用：返回结构化 StreamChunk */
  async *sendMessageStream(
    input: string | Message | Message[],
    options?: ChatCompletionOptions,
    events?: ChatEvents,
  ): AsyncGenerator<StreamChunk> {
    const inputMessages = normalizeInput(input);
    yield* this.runLoop(inputMessages, options, events);
  }

  /** 非流式调用：返回完整结果 */
  async sendMessage(
    input: string | Message | Message[],
    options?: ChatCompletionOptions,
    events?: ChatEvents,
  ): Promise<ChatResult> {
    const inputMessages = normalizeInput(input);
    let content = "";
    let reasoningContent = "";
    let toolCalls: ToolCall[] | undefined;

    for await (const chunk of this.runLoop(inputMessages, options, events)) {
      if (chunk.type === "content") {
        content += chunk.delta;
      } else if (chunk.type === "reasoning") {
        reasoningContent += chunk.delta;
      } else if (chunk.type === "tool_call") {
        // tool_calls 已在 runLoop 中写入 this.messages，这里不需要额外累加
        // 但我们可以在最后从最后一条 assistant message 中提取
      }
    }

    // 从最后一条 assistant message 中提取 toolCalls
    const lastAssistant = [...this.messages]
      .reverse()
      .find((m) => m.role === "assistant");
    toolCalls = lastAssistant?.tool_calls;

    return {
      content,
      ...(reasoningContent ? { reasoningContent } : {}),
      ...(toolCalls ? { toolCalls } : {}),
      messages: [...this.messages],
    };
  }

  // ========== Skill 上下文注入 ==========

  /**
   * 构建发送给模型的消息列表，在原 system prompt 后动态插入匹配的 skill
   */
  private buildMessagesWithSkills(
    userQuery: string,
    events?: ChatEvents,
  ): Message[] {
    if (!this.skillRegistry || !userQuery) {
      return this.messages;
    }

    const matched = this.skillRegistry.match(userQuery);
    if (matched.length === 0) {
      return this.messages;
    }

    events?.onSkillMatch?.(
      matched.map((s) => ({ name: s.name, description: s.description })),
    );

    const skillContent = matched
      .map(
        (s) =>
          `## ${s.name}\n${s.description}\n\n${s.content}`,
      )
      .join("\n\n---\n\n");

    const skillMsg: Message = {
      role: "system",
      content: `[Skills]\n${skillContent}`,
    };

    // 插入到原有 system prompt 之后（如果存在），否则放到开头
    const systemIdx = this.messages.findIndex((m) => m.role === "system");
    if (systemIdx !== -1) {
      return [
        ...this.messages.slice(0, systemIdx + 1),
        skillMsg,
        ...this.messages.slice(systemIdx + 1),
      ];
    }
    return [skillMsg, ...this.messages];
  }

  // ========== 对话状态管理 ==========

  /** 清空历史，可选择保留 system prompt */
  clearHistory(keepSystemPrompt = true): void {
    if (keepSystemPrompt && this.messages[0]?.role === "system") {
      const systemMsg = this.messages[0];
      this.messages = [systemMsg];
    } else {
      this.messages = [];
    }
  }

  getHistory(): Message[] {
    return [...this.messages];
  }

  setHistory(messages: Message[]): void {
    this.messages = [...messages];
  }

  /** 复制当前对话状态，产生独立分支 */
  fork(): Chat {
    const clone = new Chat({
      provider: this.provider,
      modelName: this.modelName,
      tools: this.tools,
      maxContextTokens: this.maxContextTokens,
      tokenizer: this.tokenizer,
      memoryManager: this.memoryManager ?? undefined,
      autoMemory: this.autoMemory,
      skillRegistry: this.skillRegistry ?? undefined,
    });
    clone.setHistory(this.messages);
    return clone;
  }
}
