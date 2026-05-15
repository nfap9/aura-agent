import type { MemoryEntry, MemoryResult } from "./types.ts";

/**
 * 轻量级文本分词
 * - 英文按空格和标点分词
 * - 中文按字分词（每个汉字作为 token）
 */
function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const tokens: string[] = [];

  // 提取英文单词
  const words = normalized.match(/[a-z0-9]+/g) || [];
  tokens.push(...words);

  // 提取中文字符
  const chineseChars = normalized.match(/[\u4e00-\u9fa5]/g) || [];
  tokens.push(...chineseChars);

  return tokens;
}

/**
 * 计算词频向量
 */
function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

/**
 * 计算余弦相似度
 */
function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>,
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, freqA] of vecA) {
    normA += freqA * freqA;
    const freqB = vecB.get(term);
    if (freqB !== undefined) {
      dotProduct += freqA * freqB;
    }
  }

  for (const freq of vecB.values()) {
    normB += freq * freq;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 计算 IDF（逆文档频率）
 */
function computeIdf(
  documents: Map<string, number>[],
): Map<string, number> {
  const idf = new Map<string, number>();
  const N = documents.length;

  // 统计包含每个词的文档数
  const docFreq = new Map<string, number>();
  for (const doc of documents) {
    for (const term of doc.keys()) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }

  for (const [term, df] of docFreq) {
    idf.set(term, Math.log(N / df) + 1);
  }

  return idf;
}

/**
 * 将词频向量应用 IDF 权重
 */
function applyIdf(
  tf: Map<string, number>,
  idf: Map<string, number>,
): Map<string, number> {
  const weighted = new Map<string, number>();
  for (const [term, freq] of tf) {
    const weight = idf.get(term) || 1;
    weighted.set(term, freq * weight);
  }
  return weighted;
}

/**
 * 时间衰减因子：越老的记忆权重越低
 * 半衰期约 30 天
 */
function timeDecay(createdAt: string): number {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
  return Math.exp(-daysDiff / 30);
}

/**
 * 检索相关记忆
 */
export function retrieveMemories(
  query: string,
  entries: MemoryEntry[],
  limit: number = 5,
  minScore: number = 0.05,
): MemoryResult[] {
  if (entries.length === 0) return [];

  const queryTokens = tokenize(query);
  const queryTf = termFrequency(queryTokens);

  // 预计算所有文档的 TF
  const docTfs = entries.map((entry) => termFrequency(tokenize(entry.content)));

  // 计算 IDF
  const idf = computeIdf(docTfs);

  // 加权查询向量
  const weightedQuery = applyIdf(queryTf, idf);

  const results: MemoryResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const weightedDoc = applyIdf(docTfs[i]!, idf);

    let score = cosineSimilarity(weightedQuery, weightedDoc);

    // 应用调整因子
    // 时间衰减
    score *= timeDecay(entry.createdAt);
    // 重要性加权
    score *= 0.5 + entry.importance / 10;
    // 访问频率加权（被频繁访问的记忆更重要）
    score *= 1 + Math.log1p(entry.accessCount) * 0.1;

    if (score >= minScore) {
      results.push({ entry, score });
    }
  }

  // 按分数降序排序
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}
