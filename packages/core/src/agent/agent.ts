import type {
  Message,
  ToolCall,
  Tokenizer,
  ChatCompletionOptions,
  AgentEvents,
  AgentResult,
} from "../types/types.js";
import type { Provider, StreamChunk } from "../llm/index.js";
import type { MemorySource } from "./ports/memory.js";
import type { SkillSource } from "./ports/skill.js";
import { Thread } from "./thread.js";
import { NullToolSource, type ToolSource } from "./ports/tool.js";

const MAX_ITERATIONS = 10;

function normalizeInput(input: string | Message | Message[]): Message[] {
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }
  if (Array.isArray(input)) {
    return input;
  }
  return [input];
}

export interface AgentConfig {
  provider: Provider;
  /** 模型名称 */
  model: string;
  /** 系统提示词 */
  systemPrompt?: string | undefined;
  /** 可用工具集 */
  tools?: ToolSource | undefined;
  /** 最大上下文 Token 数 */
  maxContextTokens?: number | undefined;
  /** 自定义分词器 */
  tokenizer?: Tokenizer | undefined;
  /** 记忆上下文源 */
  memory?: MemorySource | undefined;
  /** 是否自动将对话总结为记忆 */
  autoMemory?: boolean | undefined;
  /** 技能上下文源 */
  skills?: SkillSource | undefined;
}

/**
 * Agent：智能体执行单元
 *
 * 负责编排单次对话的完整生命周期：
 * 1. 接收输入 → 2. 注入上下文（记忆/技能）→ 3. ReAct 循环 → 4. 返回结果
 *
 * 本身不管理持久化状态，所有外部能力通过接口注入。
 */
export class Agent {
  private thread: Thread;
  private provider: Provider;
  private model: string;
  private tools: ToolSource;
  private memory?: MemorySource | undefined;
  private autoMemory: boolean;
  private skills?: SkillSource | undefined;
  private tokenizer?: Tokenizer | undefined;

  constructor(config: AgentConfig) {
    this.provider = config.provider;
    this.model = config.model;
    this.tools = config.tools || new NullToolSource();
    this.memory = config.memory;
    this.autoMemory = config.autoMemory ?? false;
    this.skills = config.skills;

    this.tokenizer = config.tokenizer;
    this.thread = new Thread({
      maxContextTokens: config.maxContextTokens ?? undefined,
      tokenizer: this.tokenizer ?? undefined,
    });

    if (config.systemPrompt) {
      this.thread.addSystemPrompt(config.systemPrompt);
    }
  }

  // ========== 核心对话接口 ==========

  /** 流式对话：返回结构化 StreamChunk */
  async *chatStream(
    input: string | Message | Message[],
    options?: ChatCompletionOptions,
    events?: AgentEvents
  ): AsyncGenerator<StreamChunk> {
    const inputMessages = normalizeInput(input);
    yield* this.runLoop(inputMessages, options, events);
  }

  /** 非流式对话：返回完整结果 */
  async chat(
    input: string | Message | Message[],
    options?: ChatCompletionOptions,
    events?: AgentEvents
  ): Promise<AgentResult> {
    const inputMessages = normalizeInput(input);
    let content = "";
    let reasoningContent = "";

    for await (const chunk of this.runLoop(inputMessages, options, events)) {
      if (chunk.type === "content") {
        content += chunk.delta;
      } else if (chunk.type === "reasoning") {
        reasoningContent += chunk.delta;
      }
    }

    const lastAssistant = this.thread
      .getMessages()
      .reverse()
      .find((m) => m.role === "assistant");
    const toolCalls = lastAssistant?.tool_calls;

    return {
      content,
      ...(reasoningContent ? { reasoningContent } : {}),
      ...(toolCalls ? { toolCalls } : {}),
      messages: this.thread.getMessages(),
    };
  }

  // ========== ReAct 执行循环 ==========

  private async *runLoop(
    inputMessages: Message[],
    options?: ChatCompletionOptions,
    events?: AgentEvents
  ): AsyncGenerator<StreamChunk> {
    // 注入记忆上下文
    if (this.memory && inputMessages.length > 0) {
      const query = inputMessages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n");
      if (query) {
        const memoryContext = await this.memory.getRelevantContext(query);
        if (memoryContext) {
          const firstUserIdx = inputMessages.findIndex((m) => m.role === "user");
          if (firstUserIdx !== -1) {
            const target = inputMessages[firstUserIdx]!;
            const original = target.content ?? "";
            inputMessages[firstUserIdx] = {
              role: target.role,
              content: `${memoryContext}\n---\n${original}`,
              ...(target.reasoning_content !== undefined
                ? { reasoning_content: target.reasoning_content }
                : {}),
              ...(target.tool_calls !== undefined ? { tool_calls: target.tool_calls } : {}),
              ...(target.tool_call_id !== undefined ? { tool_call_id: target.tool_call_id } : {}),
            };
          }
        }
      }
    }

    this.thread.addMessages(inputMessages);
    this.thread.trim();

    let continueLoop = true;
    let iteration = 0;

    const userQuery = inputMessages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");

    while (continueLoop && iteration < MAX_ITERATIONS) {
      iteration++;
      const messages = this.thread.getMessages();
      events?.onIterationStart?.(iteration, messages);

      const apiMessages = await this.buildMessagesWithSkills(userQuery, events);

      const stream = this.provider.chatStream({
        model: this.model,
        messages: apiMessages,
        tools: this.tools.getToolSchemas(),
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
      this.thread.addMessages([assistantMessage]);
      events?.onIterationEnd?.(iteration, assistantMessage);

      if (!hasToolCall) {
        continueLoop = false;
      } else {
        for (const toolCall of toolCalls) {
          const { name, arguments: args } = toolCall.function;
          let result: string;

          events?.onToolCallStart?.(toolCall);
          try {
            const parseArgs = JSON.parse(args);
            result = await this.tools.execute(name, parseArgs);
            events?.onToolCallEnd?.(toolCall, result);
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            events?.onToolCallError?.(toolCall, error);
            result = `工具执行错误: ${error.message}`;
          }

          this.thread.addMessages([
            {
              role: "tool",
              content: result,
              tool_call_id: toolCall.id,
            },
          ]);
        }
      }

      if (iteration >= MAX_ITERATIONS && hasToolCall) {
        const stopMsg = "\n[到达最大请求次数，已停止]";
        yield { type: "content", delta: stopMsg };
        continueLoop = false;
      }
    }
  }

  // ========== Skill 上下文注入 ==========

  private async buildMessagesWithSkills(
    userQuery: string,
    events?: AgentEvents
  ): Promise<Message[]> {
    if (!this.skills || !userQuery) {
      return this.thread.getMessages();
    }

    const matched = await this.skills.match(userQuery);
    if (matched.length === 0) {
      return this.thread.getMessages();
    }

    events?.onSkillMatch?.(matched.map((s) => ({ name: s.name, description: s.description })));

    const skillContent = matched
      .map((s) => `## ${s.name}\n${s.description}\n\n${s.content}`)
      .join("\n\n---\n\n");

    const skillMsg: Message = {
      role: "system",
      content: `[Skills]\n${skillContent}`,
    };

    const messages = this.thread.getMessages();
    const systemIdx = messages.findIndex((m) => m.role === "system");
    if (systemIdx !== -1) {
      return [...messages.slice(0, systemIdx + 1), skillMsg, ...messages.slice(systemIdx + 1)];
    }
    return [skillMsg, ...messages];
  }

  // ========== 状态管理 ==========

  getHistory(): Message[] {
    return this.thread.getMessages();
  }

  setHistory(messages: Message[]): void {
    this.thread.setMessages(messages);
  }

  reset(keepSystemPrompt = true): void {
    this.thread.clear(keepSystemPrompt);
  }

  /** 复制当前 Agent，产生独立分支（共享配置，隔离状态） */
  fork(): Agent {
    const clone = new Agent({
      provider: this.provider,
      model: this.model,
      tools: this.tools,
      tokenizer: this.tokenizer ?? undefined,
      memory: this.memory ?? undefined,
      autoMemory: this.autoMemory,
      skills: this.skills ?? undefined,
    });
    clone.setHistory(this.thread.getMessages());
    return clone;
  }
}
