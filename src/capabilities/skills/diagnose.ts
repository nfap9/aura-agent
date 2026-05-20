import type { SkillRegistry } from "./registry.ts";
import type { Message } from "../../types/types.ts";

export interface DiagnoseResult {
  loaded: boolean;
  skills: string[];
  matchedForQuery: Array<{ query: string; skills: string[] }>;
  injectedMessages: Message[];
  issues: string[];
}

export function diagnoseSkills(
  registry: SkillRegistry | undefined,
  testQueries: string[],
  baseMessages: Message[],
): DiagnoseResult {
  const result: DiagnoseResult = {
    loaded: false,
    skills: [],
    matchedForQuery: [],
    injectedMessages: [],
    issues: [],
  };

  if (!registry) {
    result.issues.push("SkillRegistry 未初始化（SKILLS_PATH 可能未设置）");
    return result;
  }

  const skills = registry.listSkills();
  result.skills = skills;
  result.loaded = skills.length > 0;

  if (skills.length === 0) {
    result.issues.push("SkillRegistry 已初始化，但没有加载任何 skill");
    return result;
  }

  for (const query of testQueries) {
    const matched = registry.match(query);
    result.matchedForQuery.push({
      query,
      skills: matched.map((s) => s.name),
    });
    if (matched.length === 0) {
      result.issues.push(`查询 "${query}" 没有匹配到任何 skill`);
    }
  }

  return result;
}
