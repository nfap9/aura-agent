import { describe, it, expect, vi } from "vitest";
import { Agent } from "../agent.js";
import type { Provider, StreamChunk } from "../../llm/base.js";
import type { Message } from "../../types/types.js";
import { ToolRegistry } from "../../capabilities/tools/registry.js";

describe("Agent", () => {
  function createMockProvider(chunks: StreamChunk[]): Provider {
    return {
      async *chatStream() {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    };
  }

  it("should return simple chat response", async () => {
    const provider = createMockProvider([
      { type: "content", delta: "Hello!" },
    ]);

    const agent = new Agent({ provider, model: "test-model" });
    const result = await agent.chat("Hi");

    expect(result.content).toBe("Hello!");
    expect(result.messages).toHaveLength(2); // user + assistant
  });

  it("should stream chat response", async () => {
    const provider = createMockProvider([
      { type: "content", delta: "Hello" },
      { type: "content", delta: " world" },
    ]);

    const agent = new Agent({ provider, model: "test-model" });
    const chunks: string[] = [];

    for await (const chunk of agent.chatStream("Hi")) {
      if (chunk.type === "content") chunks.push(chunk.delta);
    }

    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("should handle reasoning content", async () => {
    const provider = createMockProvider([
      { type: "reasoning", delta: "Let me think" },
      { type: "content", delta: "42" },
    ]);

    const agent = new Agent({ provider, model: "test-model" });
    const result = await agent.chat("What is 6*7?");

    expect(result.content).toBe("42");
    expect(result.reasoningContent).toBe("Let me think");
  });

  it("should call tool and continue loop", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register(
      {
        name: "echo",
        description: "Echo tool",
        parameters: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      (args) => `Echo: ${args.text}`
    );

    const provider: Provider = {
      async *chatStream(params) {
        const msgs = params.messages;
        const lastMsg = msgs[msgs.length - 1];

        if (lastMsg?.role === "user") {
          // First call: request tool
          yield {
            type: "tool_call",
            delta: "",
            toolCall: {
              index: 0,
              id: "tc1",
              name: "echo",
              arguments: '{"text":"hello"}',
            },
          };
        } else if (lastMsg?.role === "tool") {
          // Second call: final answer
          yield { type: "content", delta: "Done" };
        }
      },
    };

    const agent = new Agent({
      provider,
      model: "test-model",
      tools: toolRegistry,
    });

    const result = await agent.chat("Call echo");
    expect(result.content).toBe("Done");
    expect(result.messages.some((m) => m.role === "tool")).toBe(true);
  });

  it("should emit events during execution", async () => {
    const provider = createMockProvider([
      { type: "content", delta: "Hello" },
    ]);

    const events = {
      onIterationStart: vi.fn(),
      onIterationEnd: vi.fn(),
      onContentChunk: vi.fn(),
    };

    const agent = new Agent({ provider, model: "test-model" });
    await agent.chat("Hi", undefined, events);

    expect(events.onIterationStart).toHaveBeenCalledWith(1, expect.any(Array));
    expect(events.onIterationEnd).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ role: "assistant" })
    );
    expect(events.onContentChunk).toHaveBeenCalledWith("Hello");
  });

  it("should inject memory context", async () => {
    const provider = createMockProvider([
      { type: "content", delta: "Got it" },
    ]);

    const memory = {
      getRelevantContext: vi.fn().mockResolvedValue("User likes pizza."),
    };

    const agent = new Agent({
      provider,
      model: "test-model",
      memory,
    });

    await agent.chat("What should I eat?");

    expect(memory.getRelevantContext).toHaveBeenCalledWith("What should I eat?");
    const messages = agent.getHistory();
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("User likes pizza.");
  });

  it("should inject matched skills", async () => {
    let capturedMessages: Message[] = [];
    const provider: Provider = {
      async *chatStream(params) {
        capturedMessages = params.messages;
        yield { type: "content", delta: "Sure" };
      },
    };

    const skills = {
      match: vi.fn().mockResolvedValue([
        {
          name: "coding",
          description: "Coding skill",
          content: "Always use TypeScript.",
        },
      ]),
    };

    const events = {
      onSkillMatch: vi.fn(),
    };

    const agent = new Agent({
      provider,
      model: "test-model",
      skills,
    });

    await agent.chat("Write code", undefined, events);

    expect(skills.match).toHaveBeenCalledWith("Write code");
    expect(events.onSkillMatch).toHaveBeenCalledWith([
      { name: "coding", description: "Coding skill" },
    ]);

    // Skill system message is injected into API messages, not history
    const skillMsg = capturedMessages.find(
      (m) => m.role === "system" && m.content?.includes("[Skills]")
    );
    expect(skillMsg).toBeDefined();
    expect(skillMsg?.content).toContain("Always use TypeScript.");
  });

  it("should reset history", () => {
    const provider = createMockProvider([]);
    const agent = new Agent({
      provider,
      model: "test-model",
      systemPrompt: "System",
    });

    agent.chat("Hi");
    agent.reset();

    const messages = agent.getHistory();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "system", content: "System" });
  });

  it("should fork with shared config but isolated state", async () => {
    const provider = createMockProvider([
      { type: "content", delta: "Hello" },
    ]);

    const agent = new Agent({ provider, model: "test-model" });
    await agent.chat("Hi");

    const forked = agent.fork();
    forked.reset(false);

    expect(agent.getHistory()).toHaveLength(2);
    expect(forked.getHistory()).toHaveLength(0);
  });

  it("should handle tool execution errors gracefully", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register(
      {
        name: "fail",
        description: "Always fails",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      () => {
        throw new Error("Boom");
      }
    );

    const provider: Provider = {
      async *chatStream() {
        yield {
          type: "tool_call",
          delta: "",
          toolCall: {
            index: 0,
            id: "tc1",
            name: "fail",
            arguments: "{}",
          },
        };
      },
    };

    const events = {
      onToolCallError: vi.fn(),
    };

    const agent = new Agent({
      provider,
      model: "test-model",
      tools: toolRegistry,
    });

    await agent.chat("Trigger fail", undefined, events);
    expect(events.onToolCallError).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tc1" }),
      expect.any(Error)
    );
  });

  it("should stop at max iterations", async () => {
    const provider: Provider = {
      async *chatStream() {
        // Always request a tool call, should hit max iterations
        yield {
          type: "tool_call",
          delta: "",
          toolCall: {
            index: 0,
            id: "tc1",
            name: "echo",
            arguments: "{}",
          },
        };
      },
    };

    const toolRegistry = new ToolRegistry();
    toolRegistry.register(
      {
        name: "echo",
        description: "Echo",
        parameters: { type: "object", properties: {}, required: [] },
      },
      () => "echo"
    );

    const agent = new Agent({
      provider,
      model: "test-model",
      tools: toolRegistry,
    });

    const chunks: StreamChunk[] = [];
    for await (const chunk of agent.chatStream("Loop")) {
      chunks.push(chunk);
    }

    const lastContent = chunks
      .filter((c) => c.type === "content")
      .map((c) => c.delta)
      .join("");
    expect(lastContent).toContain("到达最大请求次数");
  });

  it("should handle array input messages", async () => {
    const provider = createMockProvider([
      { type: "content", delta: "OK" },
    ]);

    const agent = new Agent({ provider, model: "test-model" });
    const result = await agent.chat([
      { role: "user", content: "Hello" },
      { role: "user", content: "World" },
    ]);

    expect(result.content).toBe("OK");
    expect(result.messages).toHaveLength(3);
  });

  it("should handle single Message input", async () => {
    const provider = createMockProvider([
      { type: "content", delta: "OK" },
    ]);

    const agent = new Agent({ provider, model: "test-model" });
    const result = await agent.chat({ role: "user", content: "Hi" });

    expect(result.content).toBe("OK");
  });
});
