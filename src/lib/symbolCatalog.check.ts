import { lookupSymbol, normalizeSymbolLabel } from './symbolCatalog';
function check(value: unknown, message: string) { if (!value) throw new Error(message); }
check(lookupSymbol('사과') === '🍎', 'noun match');
check(lookupSymbol(' 사 과 ') === '🍎', 'spaces');
check(lookupSymbol('물 싫어요') === undefined, 'do not drop negation');
check(lookupSymbol('모르는 새 표현') === undefined, 'unknown must not guess');
check(lookupSymbol('배', [{ w: '배', i: '🫃' }]) === '🫃', 'builtin meaning wins');
check(normalizeSymbolLabel('얼마예요?') === '얼마예요', 'punctuation');
check(lookupSymbol('커피 주세요') === undefined, 'no substring matching');
console.log('symbol catalog: 7 checks passed');
