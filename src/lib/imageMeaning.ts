import concepts from '../../shared/visualConcepts.json';
/** Only exact curated nouns may skip clarification. This is not a semantic quality evaluator. */
export function getImageMeaning(label: string, kind: 'n' | 'p', explicit = '') {
 const key = label.trim().replace(/\s+/g, '');
 const nouns = concepts.nouns as Record<string, { meaning: string; scene: string }>;
 const ambiguous = concepts.ambiguous as Record<string, string[]>;
 const supplied = explicit.trim();
 const choices = ambiguous[key] ?? [];
 const noun = kind === 'n' && !choices.length ? nouns[key] : undefined;
 return {
  meaning: supplied || noun?.meaning || '',
  automatic: !supplied && !!noun,
  needsClarification: !supplied && !noun,
  choices,
 };
}
export const imageRequestKey = (label: string, kind: 'n'|'p', meaning: string) => JSON.stringify([label.trim(), kind, meaning.trim()]);
