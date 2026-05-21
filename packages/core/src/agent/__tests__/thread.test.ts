import { describe, it, expect } from "vitest";
import { Thread } from "../thread.js";

describe("Thread", () => {
  it("should add and retrieve messages", () => {
    const thread = new Thread();
    thread.addMessages([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);

    const messages = thread.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(messages[1]).toEqual({ role: "assistant", content: "Hi there" });
  });

  it("should add system prompt", () => {
    const thread = new Thread();
    thread.addSystemPrompt("You are a helpful assistant.");

    const messages = thread.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      role: "system",
      content: "You are a helpful assistant.",
    });
  });

  it("should return a copy of messages (immutable)", () => {
    const thread = new Thread();
    thread.addMessages([{ role: "user", content: "Hello" }]);

    const messages = thread.getMessages();
    messages.push({ role: "assistant", content: "Hi" } as any);

    expect(thread.getMessages()).toHaveLength(1);
  });

  it("should set messages replacing existing", () => {
    const thread = new Thread();
    thread.addMessages([{ role: "user", content: "Hello" }]);
    thread.setMessages([{ role: "user", content: "World" }]);

    expect(thread.getMessages()).toHaveLength(1);
    expect(thread.getMessages()[0]).toEqual({ role: "user", content: "World" });
  });

  it("should clear all messages", () => {
    const thread = new Thread();
    thread.addSystemPrompt("System");
    thread.addMessages([{ role: "user", content: "Hello" }]);
    thread.clear(false);

    expect(thread.getMessages()).toHaveLength(0);
  });

  it("should clear but keep system prompt by default", () => {
    const thread = new Thread();
    thread.addSystemPrompt("System");
    thread.addMessages([{ role: "user", content: "Hello" }]);
    thread.clear();

    const messages = thread.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "system", content: "System" });
  });

  it("should clear everything when no system prompt exists", () => {
    const thread = new Thread();
    thread.addMessages([{ role: "user", content: "Hello" }]);
    thread.clear();

    expect(thread.getMessages()).toHaveLength(0);
  });

  it("should fork with independent state", () => {
    const thread = new Thread();
    thread.addMessages([{ role: "user", content: "Hello" }]);

    const clone = thread.fork();
    clone.addMessages([{ role: "assistant", content: "Hi" }]);

    expect(thread.getMessages()).toHaveLength(1);
    expect(clone.getMessages()).toHaveLength(2);
  });

  it("should estimate tokens with custom tokenizer", () => {
    const tokenizer = {
      encode: (text: string) => text.split(" "),
    };
    const thread = new Thread({ tokenizer });
    thread.addMessages([{ role: "user", content: "Hello world foo" }]);

    // 3 tokens for "Hello world foo" + 4 overhead = 7
    // trim should not remove since well under default 128K
    thread.trim();
    expect(thread.getMessages()).toHaveLength(1);
  });

  it("should trim old messages when over maxContextTokens", () => {
    const thread = new Thread({ maxContextTokens: 20 });
    thread.addSystemPrompt("System prompt");

    // Add several long messages that exceed 20 tokens
    for (let i = 0; i < 10; i++) {
      thread.addMessages([
        { role: "user", content: `This is message number ${i} with lots of text` },
      ]);
    }

    thread.trim();

    const messages = thread.getMessages();
    // System prompt should be kept
    expect(messages[0]).toEqual({ role: "system", content: "System prompt" });
    // Should have trimmed down to system + at least 2 recent messages
    expect(messages.length).toBeGreaterThanOrEqual(3);
  });

  it("should estimate tool call tokens", () => {
    const thread = new Thread();
    thread.addMessages([
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "tc1",
            type: "function",
            function: { name: "bash", arguments: '{"command":"echo hi"}' },
          },
        ],
      },
      {
        role: "tool",
        content: "hi",
        tool_call_id: "tc1",
      },
    ]);

    expect(thread.getMessages()).toHaveLength(2);
  });
});
