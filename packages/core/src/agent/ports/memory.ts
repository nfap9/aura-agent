/**
 * 记忆上下文源：为 Agent 提供与当前查询相关的历史记忆
 */
export interface MemorySource {
  getRelevantContext(query: string): Promise<string | undefined>;
}
