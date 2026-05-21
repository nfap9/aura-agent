import { describe, it, expect } from "vitest";
import { retrieveMemories } from "../retriever.js";
import type { MemoryEntry } from "../types.js";

function createEntry(
  content: string,
  overrides: Partial<MemoryEntry> = {}
): MemoryEntry {
  const now = new Date().toISOString();
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    content,
    category: "fact",
    importance: 5,
    createdAt: now,
    updatedAt: now,
    accessCount: 0,
    ...overrides,
  };
}

describe("retrieveMemories", () => {
  it("should return empty array for empty entries", () => {
    const results = retrieveMemories("test", []);
    expect(results).toEqual([]);
  });

  it("should return empty array when no matches", () => {
    const entries = [
      createEntry("苹果是一种水果"),
      createEntry("香蕉是黄色的"),
    ];
    const results = retrieveMemories("汽车发动机", entries);
    expect(results).toEqual([]);
  });

  it("should match by keyword relevance", () => {
    const entries = [
      createEntry("用户喜欢披萨"),
      createEntry("用户讨厌橄榄"),
      createEntry("会议安排在下午三点"),
    ];

    const results = retrieveMemories("用户喜欢什么食物", entries);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].entry.content).toContain("披萨");
  });

  it("should score higher for more relevant content", () => {
    const entries = [
      createEntry("Python 是一种编程语言"),
      createEntry("JavaScript 也是一种编程语言，与 Python 类似"),
      createEntry("我喜欢吃苹果"),
    ];

    const results = retrieveMemories("编程语言 Python", entries);
    expect(results[0].entry.content).toContain("Python");
  });

  it("should respect limit parameter", () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      createEntry(`记忆内容 ${i}`)
    );

    const results = retrieveMemories("记忆", entries, 3);
    expect(results).toHaveLength(3);
  });

  it("should respect minScore parameter", () => {
    const entries = [
      createEntry("完全无关的内容 xyzabc"),
      createEntry("稍微相关一点点"),
    ];

    const results = retrieveMemories("量子物理", entries, 5, 0.5);
    expect(results).toHaveLength(0);
  });

  it("should boost recent memories", () => {
    const oldEntry = createEntry("旧记忆", {
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(), // 60 days ago
    });
    const newEntry = createEntry("新记忆", {
      createdAt: new Date().toISOString(),
    });

    const results = retrieveMemories("记忆", [oldEntry, newEntry]);
    expect(results[0].entry.content).toBe("新记忆");
  });

  it("should boost high-importance memories", () => {
    const lowEntry = createEntry("低重要性", { importance: 1 });
    const highEntry = createEntry("高重要性", { importance: 10 });

    const results = retrieveMemories("重要性", [lowEntry, highEntry]);
    expect(results[0].entry.content).toBe("高重要性");
  });

  it("should boost frequently accessed memories", () => {
    const rarelyAccessed = createEntry("很少访问", { accessCount: 0 });
    const oftenAccessed = createEntry("经常访问", { accessCount: 50 });

    const results = retrieveMemories("访问", [rarelyAccessed, oftenAccessed]);
    expect(results[0].entry.content).toBe("经常访问");
  });

  it("should handle English content", () => {
    const entries = [
      createEntry("User likes pizza food"),
      createEntry("User prefers sushi food"),
      createEntry("Meeting at 3pm"),
    ];

    const results = retrieveMemories("pizza food", entries);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].entry.content).toContain("pizza");
  });

  it("should handle mixed Chinese and English", () => {
    const entries = [
      createEntry("用户喜欢使用 Python 编程"),
      createEntry("用户喜欢 JavaScript"),
    ];

    const results = retrieveMemories("Python programming", entries);
    expect(results[0].entry.content).toContain("Python");
  });

  it("should return results sorted by score descending", () => {
    const entries = [
      createEntry("aaa"),
      createEntry("bbb"),
      createEntry("ccc"),
    ];

    const results = retrieveMemories("aaa bbb ccc", entries);
    // All have same base relevance, but should still be sorted
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});
