import type { Skill } from "./types.ts";
import { loadSkillsFromDirectory } from "./loader.ts";

export interface SkillRegistryOptions {
  /** 最大同时激活的 skill 数量，防止 prompt 过长 */
  maxActiveSkills?: number;
}

/**
 * Skill 注册表：管理已加载的 skill，支持按查询匹配
 */
export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private maxActiveSkills: number;

  constructor(options: SkillRegistryOptions = {}) {
    this.maxActiveSkills = options.maxActiveSkills ?? 3;
  }

  /**
   * 注册一个 skill
   */
  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      console.warn(`Skill "${skill.name}" already registered, overwriting.`);
    }
    this.skills.set(skill.name, skill);
  }

  /**
   * 根据用户查询匹配相关 skill
   * 简单策略：检查 query 关键词是否出现在 skill 的 name / description 中
   */
  match(query: string): Skill[] {
    if (!query || this.skills.size === 0) return [];

    const lowerQuery = query.toLowerCase();
    // 提取长度 >= 2 的关键词（中文单字也保留）
    const keywords = lowerQuery.split(/\s+/).filter((w) => w.length >= 1 && !isStopWord(w));

    if (keywords.length === 0) return [];

    const scored: { skill: Skill; score: number }[] = [];

    for (const skill of this.skills.values()) {
      // hidden skill 不参与自动匹配
      if (skill.metadata.hidden === true) continue;

      const haystack = `${skill.name} ${skill.description} ${skill.content}`.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (haystack.includes(kw)) score += 1;
      }
      if (score > 0) {
        scored.push({ skill, score });
      }
    }

    // 按匹配分数降序，取前 N 个
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.maxActiveSkills).map((s) => s.skill);
  }

  /**
   * 获取指定名称的 skill（用于精确加载）
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * 列出所有已注册 skill 的名称
   */
  listSkills(): string[] {
    return Array.from(this.skills.keys());
  }

  get count(): number {
    return this.skills.size;
  }

  /**
   * 从目录批量加载 skill
   */
  static async fromDirectory(
    dirPath: string,
    options?: SkillRegistryOptions
  ): Promise<SkillRegistry> {
    const registry = new SkillRegistry(options);
    const skills = await loadSkillsFromDirectory(dirPath);
    for (const skill of skills) {
      registry.register(skill);
    }
    return registry;
  }
}

/** 简单的英文停用词过滤 */
function isStopWord(word: string): boolean {
  const stops = new Set([
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "dare",
    "ought",
    "used",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "and",
    "but",
    "if",
    "or",
    "because",
    "until",
    "while",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "my",
    "myself",
    "we",
    "our",
    "you",
    "your",
    "he",
    "him",
    "his",
    "she",
    "her",
    "it",
    "its",
    "they",
    "them",
    "their",
    "s",
    "t",
    "don",
  ]);
  return stops.has(word.toLowerCase());
}
