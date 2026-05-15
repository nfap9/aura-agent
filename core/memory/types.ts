/**
 * 单条记忆条目
 */
export interface MemoryEntry {
  /** 唯一标识 */
  id: string;
  /** 记忆内容 */
  content: string;
  /** 记忆类别：fact（事实）, preference（偏好）, event（事件）, summary（总结） */
  category: "fact" | "preference" | "event" | "summary" | string;
  /** 重要程度 1-10 */
  importance: number;
  /** 创建时间 ISO */
  createdAt: string;
  /** 最后更新时间 ISO */
  updatedAt: string;
  /** 被检索次数 */
  accessCount: number;
  /** 可选元数据 */
  metadata?: Record<string, any>;
}

/**
 * 记忆检索结果
 */
export interface MemoryResult {
  entry: MemoryEntry;
  /** 相似度得分 0-1 */
  score: number;
}

/**
 * 存储后端接口
 */
export interface MemoryStorage {
  load(): Promise<MemoryEntry[]>;
  save(entries: MemoryEntry[]): Promise<void>;
}
