/**
 * Skill 元数据（从 SKILL.md frontmatter 解析）
 */
export interface SkillMetadata {
  name: string;
  description: string;
  [key: string]: any;
}

/**
 * 单个 Skill 对象
 */
export interface Skill {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 去掉 frontmatter 后的 Markdown 内容 */
  content: string;
  /** 完整的 frontmatter 原始数据 */
  metadata: Record<string, any>;
  /** 来源文件路径 */
  sourcePath?: string;
}
