/**
 * 敏感词库匹配服务
 * 本地匹配，不消耗 API token，100% 确定性
 */

import lexiconData from '../../data/lexicon.json';

export interface LexiconEntry {
  id: string;
  pattern: string;
  patternType: 'keyword' | 'regex';
  domain: 'general' | 'cosmetics' | 'food' | 'pharma' | 'supplement';
  market: 'general' | 'US' | 'EU' | 'CN' | 'CA';
  severity: 'P0' | 'P1' | 'P2';
  reason: string;
  suggestion: string;
  source?: string;
  sourceUrl?: string;
  category?: string;
}

export interface LexiconHit {
  entry: LexiconEntry;
  matchedText: string;
  position: number;
  context: string;  // 命中位置的上下文
}

// 加载词库
const lexicon: LexiconEntry[] = lexiconData.entries as LexiconEntry[];

/**
 * 匹配词库
 * @param text OCR 提取的文本
 * @param domain 行业（可选，不传则匹配所有）
 * @param market 市场（可选，不传则匹配所有）
 */
export const matchLexicon = (
  text: string,
  domain?: string,
  market?: string
): LexiconHit[] => {
  const hits: LexiconHit[] = [];
  const lowerText = text.toLowerCase();

  for (const entry of lexicon) {
    // 过滤 domain（general 匹配所有）
    if (domain && entry.domain !== 'general' && entry.domain !== domain) {
      continue;
    }
    // 过滤 market（general 匹配所有）
    if (market && entry.market !== 'general' && entry.market !== market) {
      continue;
    }

    let matches: RegExpMatchArray[] = [];

    if (entry.patternType === 'keyword') {
      // 关键词匹配（大小写不敏感）
      const pattern = new RegExp(`\\b${escapeRegex(entry.pattern)}\\b`, 'gi');
      matches = [...lowerText.matchAll(pattern)];
    } else {
      // 正则匹配
      try {
        const pattern = new RegExp(entry.pattern, 'gi');
        matches = [...text.matchAll(pattern)];
      } catch (e) {
        console.warn(`Invalid regex pattern: ${entry.pattern}`, e);
      }
    }

    for (const match of matches) {
      const position = match.index || 0;
      const context = getContext(text, position, match[0].length);

      hits.push({
        entry,
        matchedText: match[0],
        position,
        context
      });
    }
  }

  // 去重（同一位置只保留最高优先级）
  return deduplicateHits(hits);
};

/**
 * 获取命中位置的上下文
 */
const getContext = (text: string, position: number, matchLength: number, contextSize = 30): string => {
  const start = Math.max(0, position - contextSize);
  const end = Math.min(text.length, position + matchLength + contextSize);
  let context = text.substring(start, end);

  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context;
};

/**
 * 转义正则特殊字符
 */
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * 去重：同一位置只保留最高优先级的命中
 */
const deduplicateHits = (hits: LexiconHit[]): LexiconHit[] => {
  const severityOrder = { P0: 0, P1: 1, P2: 2 };

  // 按位置分组
  const byPosition = new Map<number, LexiconHit[]>();
  for (const hit of hits) {
    const key = hit.position;
    if (!byPosition.has(key)) {
      byPosition.set(key, []);
    }
    byPosition.get(key)!.push(hit);
  }

  // 每个位置只保留最高优先级
  const result: LexiconHit[] = [];
  for (const group of byPosition.values()) {
    group.sort((a, b) => severityOrder[a.entry.severity] - severityOrder[b.entry.severity]);
    result.push(group[0]);
  }

  return result.sort((a, b) => a.position - b.position);
};

/**
 * 将词库命中转换为 DiagnosisIssue 格式
 */
export const lexiconHitsToIssues = (hits: LexiconHit[]) => {
  return hits.map((hit, idx) => ({
    id: `lex-${hit.entry.id}-${idx}-${Date.now()}`,
    type: 'lexicon' as const,
    original: hit.matchedText,
    problem: hit.entry.reason,
    suggestion: hit.entry.suggestion,
    severity: hit.entry.severity === 'P0' ? 'high' : hit.entry.severity === 'P1' ? 'medium' : 'low',
    confidence: 'certain' as const,  // 词库命中是确定性的
    ruleHits: [{
      type: 'lexicon' as const,
      id: hit.entry.id,
      source: hit.entry.source,
      sourceUrl: hit.entry.sourceUrl
    }],
    context: hit.context
  }));
};

/**
 * 获取词库统计信息
 */
export const getLexiconStats = (entries: LexiconEntry[] = lexicon) => {
  const stats = {
    total: entries.length,
    byDomain: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    byMarket: {} as Record<string, number>
  };

  for (const entry of entries) {
    stats.byDomain[entry.domain] = (stats.byDomain[entry.domain] || 0) + 1;
    stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;
    stats.byMarket[entry.market] = (stats.byMarket[entry.market] || 0) + 1;
  }

  return stats;
};
