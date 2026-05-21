import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../registry.js";
import type { ToolDefinition } from "../types.js";

describe("ToolRegistry", () => {
  const echoDef: ToolDefinition = {
    name: "echo",
    description: "Echo input",
    parameters: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  };

  it("should register and execute a tool", async () => {
    const registry = new ToolRegistry();
    registry.register(echoDef, (args) => `Echo: ${args.text}`);

    const schemas = registry.getToolSchemas();
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toEqual({
      type: "function",
      function: {
        name: "echo",
        description: "Echo input",
        parameters: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
    });

    const result = await registry.execute("echo", { text: "hello" });
    expect(result).toBe("Echo: hello");
  });

  it("should overwrite duplicate tool with warning", () => {
    const registry = new ToolRegistry();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    registry.register(echoDef, () => "v1");
    registry.register(echoDef, () => "v2");

    expect(warnSpy).toHaveBeenCalledWith('Tool "echo" already registered, overwriting.');
    expect(registry.count).toBe(1);

    warnSpy.mockRestore();
  });

  it("should throw on unknown tool", async () => {
    const registry = new ToolRegistry();

    await expect(registry.execute("unknown", {})).rejects.toThrow(
      'Unknown tool: "unknown"'
    );
  });

  it("should list all tool names", () => {
    const registry = new ToolRegistry();
    registry.register({ ...echoDef, name: "echo" }, () => "");
    registry.register({ ...echoDef, name: "reverse" }, () => "");

    expect(registry.listTools()).toEqual(["echo", "reverse"]);
  });

  it("should check tool existence", () => {
    const registry = new ToolRegistry();
    registry.register(echoDef, () => "");

    expect(registry.hasTool("echo")).toBe(true);
    expect(registry.hasTool("missing")).toBe(false);
  });

  it("should support async handlers", async () => {
    const registry = new ToolRegistry();
    registry.register(echoDef, async (args) => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(`Async: ${args.text}`), 10);
      });
    });

    const result = await registry.execute("echo", { text: "hello" });
    expect(result).toBe("Async: hello");
  });

  it("should return correct count", () => {
    const registry = new ToolRegistry();
    expect(registry.count).toBe(0);

    registry.register(echoDef, () => "");
    expect(registry.count).toBe(1);
  });
});
