/**
 * 技能信息（编排层消费的最小结构）
 */
export interface SkillInfo {
  name: string;
  description: string;
  content: string;
}

/**
 * 技能能力契约：编排层只关心"能否根据查询匹配到相关技能"
 *
 * 具体实现可以是关键词匹配、向量检索、图谱推理等。
 */
export interface SkillProvider {
  match(query: string): Promise<SkillInfo[]> | SkillInfo[];
}
