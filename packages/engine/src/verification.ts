import { completeDfa, subsetConstruction, validateAutomaton } from './index.js';
import type { Automaton } from './types.js';

export type EquivalenceResult = { equivalent: true } | { equivalent: false; counterexample: string; shouldAccept: boolean };
export function asDfa(a: Automaton, alphabet = a.alphabet): Automaton {
  return completeDfa(a.kind === 'DFA' ? { ...a, alphabet } : subsetConstruction({ ...a, alphabet }).automaton);
}
export function checkEquivalence(student: Automaton, reference: Automaton, deadline = Infinity): EquivalenceResult {
  for (const a of [student, reference]) {
    const errors = validateAutomaton(a);
    if (errors.length) throw new Error(errors.map(e => e.message).join(' '));
  }
  const alphabet = [...new Set([...student.alphabet, ...reference.alphabet])].sort();
  const left = asDfa(student, alphabet), right = asDfa(reference, alphabet);
  const maps = [left, right].map(a => new Map(a.transitions.map(t => [JSON.stringify([t.from, t.symbol]), t.to])));
  const queue: { l: string; r: string; word: string }[] = [{ l: left.start, r: right.start, word: '' }];
  const seen = new Set([JSON.stringify([left.start, right.start])]);
  for (const item of queue) {
    if (Date.now() > deadline) throw new Error('Search timed out.');
    const accepted = right.finals.includes(item.r);
    if (left.finals.includes(item.l) !== accepted) return { equivalent: false, counterexample: item.word, shouldAccept: accepted };
    for (const symbol of alphabet) {
      const l = maps[0]?.get(JSON.stringify([item.l, symbol]));
      const r = maps[1]?.get(JSON.stringify([item.r, symbol]));
      if (l === undefined || r === undefined) throw new Error('Incomplete product.');
      const key = JSON.stringify([l, r]);
      if (!seen.has(key)) { seen.add(key); queue.push({ l, r, word: item.word + symbol }); }
    }
  }
  return { equivalent: true };
}
