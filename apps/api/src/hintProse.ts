/** Normalize prose punctuation while preserving literal automaton identifiers. */
export function normalizeHintProse(text: string, literals: string[]): string {
  const protectedValues = [...new Set(literals)].filter(value => value.includes('\u2014')).sort((a, b) => b.length - a.length);
  if (!protectedValues.length) return text.replaceAll('\u2014', ', ');
  const pattern = new RegExp(protectedValues.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  let cursor = 0;
  let result = '';
  for (const match of text.matchAll(pattern)) {
    result += text.slice(cursor, match.index).replaceAll('\u2014', ', ') + match[0];
    cursor = match.index + match[0].length;
  }
  return result + text.slice(cursor).replaceAll('\u2014', ', ');
}
