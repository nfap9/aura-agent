import { describe, it, expect } from "vitest";
import { MemoryManager } from "../manager.js";
import { InMemoryStorage } from "../store.js";

describe("MemoryManager", () => {
  function createManager(options: Parameters<typeof MemoryManager>[0] = {}) {
    return new MemoryManager({ storage: new InMemoryStorage(), ...options });
  }

  it("should save and retrieve memory", async () => {
    const manager = createManager();
    const entry = await manager.saveMemory("User likes pizza", "preference", 8);

    expect(entry.content).toBe("User likes pizza");
    expect(entry.category).toBe("preference");
    expect(entry.importance).toBe(8);
    expect(entry.id).toBeDefined();
    expect(entry.createdAt).toBeDefined();
  });

  it("should clamp importance to 1-10", async () => {
    const manager = createManager();
    const low = await manager.saveMemory("test", "fact", -5);
    const high = await manager.saveMemory("test2", "fact", 15);

    expect(low.importance).toBe(1);
    expect(high.importance).toBe(10);
  });

  it("should search memories", async () => {
    const manager = createManager();
    await manager.saveMemory("User likes pizza food", "preference", 8);
    await manager.saveMemory("User hates olives food", "preference", 5);
    await manager.saveMemory("Meeting at 3pm", "event", 3);

    const results = await manager.searchMemories("pizza food preferences");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("should return relevant context string", async () => {
    const manager = createManager();
    await manager.saveMemory("User likes pizza", "preference", 8);

    const context = await manager.getRelevantContext("What food does user like?");
    expect(context).toContain("User likes pizza");
    expect(context).toContain("相关历史记忆");
  });

  it("should return empty context when no matches", async () => {
    const manager = createManager();
    const context = await manager.getRelevantContext("xyzabc123");
    expect(context).toBe("");
  });

  it("should delete memory", async () => {
    const manager = createManager();
    const entry = await manager.saveMemory("To delete", "fact", 1);

    const deleted = await manager.deleteMemory(entry.id);
    expect(deleted).toBe(true);

    const notFound = await manager.deleteMemory(entry.id);
    expect(notFound).toBe(false);
  });

  it("should list all memories", async () => {
    const manager = createManager();
    await manager.saveMemory("One", "fact", 1);
    await manager.saveMemory("Two", "fact", 2);

    const list = await manager.listMemories();
    expect(list).toHaveLength(2);
  });

  it("should get memory by id", async () => {
    const manager = createManager();
    const entry = await manager.saveMemory("Test", "fact", 5);

    const found = await manager.getMemory(entry.id);
    expect(found).toEqual(entry);

    const notFound = await manager.getMemory("nonexistent");
    expect(notFound).toBeUndefined();
  });

  it("should update access count on search", async () => {
    const manager = createManager();
    const entry = await manager.saveMemory("User likes pizza", "preference", 8);
    expect(entry.accessCount).toBe(0);

    await manager.searchMemories("pizza");
    const updated = await manager.getMemory(entry.id);
    expect(updated!.accessCount).toBe(1);
  });

  it("should merge similar memories", async () => {
    const manager = createManager();
    const entry1 = await manager.saveMemory("User likes pizza", "preference", 5);
    const entry2 = await manager.saveMemory("User likes pizza", "preference", 8);

    // Identical content should merge
    expect(entry1.id).toBe(entry2.id);
    expect(entry2.importance).toBe(8);
    expect(entry2.accessCount).toBe(1);
  });

  it("should cleanup low-value memories", async () => {
    const manager = createManager({ maxEntries: 3 });

    // Save 4 memories to trigger cleanup
    await manager.saveMemory("High importance", "fact", 10);
    await manager.saveMemory("Medium importance", "fact", 5);
    await manager.saveMemory("Low importance old", "fact", 1);
    await manager.saveMemory("Another low", "fact", 1);

    const count = await manager.getCount();
    expect(count).toBeLessThanOrEqual(3);
  });

  it("should count memories", async () => {
    const manager = createManager();
    expect(await manager.getCount()).toBe(0);

    await manager.saveMemory("One", "fact", 1);
    expect(await manager.getCount()).toBe(1);
  });

  it("should handle metadata", async () => {
    const manager = createManager();
    const entry = await manager.saveMemory("Test", "fact", 5, { source: "chat" });

    expect(entry.metadata).toEqual({ source: "chat" });
  });
});
