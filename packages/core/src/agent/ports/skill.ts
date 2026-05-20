/**
 * 技能信息（注入到 system prompt 中的最小结构）
 */
export interface SkillInfo {
  name: string;
  description: string;
  content: string;
}

/**
 * 技能上下文源：根据用户查询匹配相关技能
 */
export interface SkillSource {
  match(query: string): Promise<SkillInfo[]> | SkillInfo[];
}
