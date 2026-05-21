import { describe, it, expect } from "vitest";
import { createMemoryTools } from "../memory-tool.js";
import { MemoryManager } from "../../memory/manager.js";
import { InMemoryStorage } from "../../memory/store.js";

describe("createMemoryTools", () => {
  function createManager() {
    return new MemoryManager({ storage: new InMemoryStorage() });
  }

  it("should create save, search, delete, and list tools", () => {
    const manager = createManager();
    const tools = createMemoryTools(manager);

    expect(tools.definitions).toHaveLength(4);
    const names = tools.definitions.map((d) => d.name);
    expect(names).toContain("memory_save");
    expect(names).toContain("memory_search");
    expect(names).toContain("memory_delete");
    expect(names).toContain("memory_list");

    expect(tools.handlers).toHaveProperty("memory_save");
    expect(tools.handlers).toHaveProperty("memory_search");
    expect(tools.handlers).toHaveProperty("memory_delete");
    expect(tools.handlers).toHaveProperty("memory_list");
  });

  it("should save memory via tool", async () => {
    const manager = createManager();
    const tools = createMemoryTools(manager);

    const result = await tools.handlers.memory_save({
      content: "User likes pizza",
      category: "preference",
      importance: 8,
    });

    expect(result).toContain("已保存记忆");
    expect(result).toContain("preference");
    expect(result).toContain("8");

    const entries = await manager.listMemories();
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe("User likes pizza");
  });

  it("should use default category and importance", async () => {
    const manager = createManager();
    const tools = createMemoryTools(manager);

    await tools.handlers.memory_save({ content: "Test" });
    const entries = await manager.listMemories();

    expect(entries[0].category).toBe("fact");
    expect(entries[0].importance).toBe(5);
  });

  it("should search memory via tool", async () => {
    const manager = createManager();
    const tools = createMemoryTools(manager);

    await manager.saveMemory("User likes pizza food", "preference", 8);
    await manager.saveMemory("User hates olives food", "preference", 5);

    const result = await tools.handlers.memory_search({
      query: "pizza food",
      limit: 5,
    });

    expect(result).toContain("pizza");
    expect(result).toContain("olives");
  });

  it("should return no results message", async () => {
    const manager = createManager();
    const tools = createMemoryTools(manager);

    const result = await tools.handlers.memory_search({ query: "xyzabc" });
    expect(result).toBe("未找到相关记忆。");
  });

  it("should delete memory via tool", async () => {
    const manager = createManager();
    const tools = createMemoryTools(manager);

    const entry = await manager.saveMemory("To delete", "fact", 1);

    const result = await tools.handlers.memory_delete({ id: entry.id });
    expect(result).toBe("已删除记忆。");

    const notFound = await tools.handlers.memory_delete({ id: entry.id });
    expect(notFound).toContain("未找到");
  });

  it("should list memories via tool", async () => {
    const manager = createManager();
    const tools = createMemoryTools(manager);

    await manager.saveMemory("One", "fact", 1);
    await manager.saveMemory("Two", "fact", 2);

    const result = await tools.handlers.memory_list({});
    expect(result).toContain("One");
    expect(result).toContain("Two");
  });

  it("should return empty list message", async () => {
    const manager = createManager();
    const tools = createMemoryTools(manager);

    const result = await tools.handlers.memory_list({});
    expect(result).toBe("当前没有保存任何记忆。");
  });
});
