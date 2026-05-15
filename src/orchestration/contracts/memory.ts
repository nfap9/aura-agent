/**
 * 记忆能力契约：编排层只关心"能否根据查询获取相关上下文"
 *
 * 具体实现可以是向量数据库、文件存储、图谱检索等。
 */
export interface MemoryProvider {
  getRelevantContext(query: string): Promise<string | undefined>;
}
