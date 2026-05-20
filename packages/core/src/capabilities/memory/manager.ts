import type { MemoryEntry, MemoryResult, MemoryStorage } from "./types.js";
import { retrieveMemories } from "./retriever.js";
import { InMemoryStorage } from "./store.js";
import type { MemorySource } from "../../agent/index.js";

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface MemoryManagerOptions {
  storage?: MemoryStorage | undefined;
  /** 默认检索返回条数 */
  defaultLimit?: number | undefined;
  /** 最小相似度阈值 */
  minScore?: number | undefined;
  /** 最大记忆条数，超过时触发清理 */
  maxEntries?: number | undefined;
}

/**
 * 长期记忆管理器
 *
 * 负责记忆的增删改查、检索、以及自动整理（consolidation）。
 */
export class MemoryManager implements MemorySource {
  private storage: MemoryStorage;
  private entries: MemoryEntry[] = [];
  private initialized = false;
  private defaultLimit: number;
  private minScore: number;
  private maxEntries: number;

  constructor(options: MemoryManagerOptions = {}) {
    this.storage = options.storage ?? new InMemoryStorage();
    this.defaultLimit = options.defaultLimit ?? 5;
    this.minScore = options.minScore ?? 0.05;
    this.maxEntries = options.maxEntries ?? 500;
  }

  private async init() {
    if (this.initialized) return;
    this.entries = await this.storage.load();
    this.initialized = true;
  }

  private async persist() {
    await this.storage.save(this.entries);
  }

  /**
   * 保存一条新记忆，如果内容高度相似则合并
   */
  async saveMemory(
    content: string,
    category: string = "fact",
    importance: number = 5,
    metadata?: Record<string, any>
  ): Promise<MemoryEntry> {
    await this.init();

    const now = new Date().toISOString();

    // 检查是否有高度相似的记忆（相似度 > 0.8），有则合并更新
    const similar = retrieveMemories(content, this.entries, 1, 0.8);
    if (similar.length > 0) {
      const existing = similar[0]!.entry;
      // 更新内容（保留旧内容作为上下文）
      existing.content = this.mergeContent(existing.content, content);
      existing.updatedAt = now;
      existing.importance = Math.max(existing.importance, importance);
      existing.accessCount++;
      if (metadata !== undefined) {
        existing.metadata = { ...(existing.metadata ?? {}), ...metadata };
      }
      await this.persist();
      return existing;
    }

    const entry: MemoryEntry = {
      id: generateId(),
      content: content.trim(),
      category,
      importance: Math.max(1, Math.min(10, importance)),
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      ...(metadata !== undefined ? { metadata } : {}),
    };

    this.entries.push(entry);

    // 如果超过最大条数，触发清理
    if (this.entries.length > this.maxEntries) {
      await this.cleanup();
    } else {
      await this.persist();
    }

    return entry;
  }

  /**
   * 根据查询检索相关记忆
   */
  async searchMemories(query: string, limit?: number): Promise<MemoryResult[]> {
    await this.init();
    const results = retrieveMemories(
      query,
      this.entries,
      limit ?? this.defaultLimit,
      this.minScore
    );

    // 更新访问计数
    for (const result of results) {
      result.entry.accessCount++;
      result.entry.updatedAt = new Date().toISOString();
    }

    if (results.length > 0) {
      await this.persist();
    }

    return results;
  }

  /**
   * 根据上下文获取相关记忆，格式化为字符串供注入 prompt
   */
  async getRelevantContext(context: string, limit?: number): Promise<string> {
    const results = await this.searchMemories(context, limit);
    if (results.length === 0) return "";

    const lines = results.map((r, i) => {
      const prefix = r.entry.category ? `[${r.entry.category}] ` : "";
      return `${i + 1}. ${prefix}${r.entry.content}`;
    });

    return `## 相关历史记忆\n${lines.join("\n")}\n`;
  }

  /**
   * 删除指定记忆
   */
  async deleteMemory(id: string): Promise<boolean> {
    await this.init();
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    await this.persist();
    return true;
  }

  /**
   * 列出所有记忆
   */
  async listMemories(): Promise<MemoryEntry[]> {
    await this.init();
    return [...this.entries];
  }

  /**
   * 根据 ID 获取记忆
   */
  async getMemory(id: string): Promise<MemoryEntry | undefined> {
    await this.init();
    return this.entries.find((e) => e.id === id);
  }

  /**
   * 清理低价值记忆：保留重要性高、访问频繁、较新的记忆
   */
  async cleanup(targetCount?: number): Promise<void> {
    await this.init();
    const target = targetCount ?? Math.floor(this.maxEntries * 0.8);
    if (this.entries.length <= target) return;

    // 计算每条记忆的综合评分
    const now = Date.now();
    const scored = this.entries.map((entry) => {
      const daysOld = (now - new Date(entry.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-daysOld / 30);
      const importanceScore = entry.importance / 10;
      const accessScore = Math.log1p(entry.accessCount) / Math.log1p(100);
      const totalScore = recencyScore * 0.3 + importanceScore * 0.4 + accessScore * 0.3;
      return { entry, score: totalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    this.entries = scored.slice(0, target).map((s) => s.entry);
    await this.persist();
  }

  /**
   * 合并相似记忆内容
   */
  private mergeContent(oldContent: string, newContent: string): string {
    // 简单策略：如果旧内容较短，直接拼接；否则更新
    if (oldContent.length < 200) {
      return `${oldContent} | 更新: ${newContent}`;
    }
    return newContent;
  }

  /**
   * 获取记忆数量
   */
  async getCount(): Promise<number> {
    await this.init();
    return this.entries.length;
  }
}
