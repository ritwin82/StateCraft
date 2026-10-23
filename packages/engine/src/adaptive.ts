import type { Automaton } from './types.js';
import { applyEdit, type Edit } from './diagnosis.js';
import { randomSource } from './questions.js';
import { checkEquivalence } from './verification.js';
export function updateMastery(rating: number, difficulty: number, score: number): number {
  const expected = 1 / (1 + 10 ** ((difficulty * 300 - rating) / 400));
  return Math.max(100, Math.min(2000, Math.round(rating + 48 * (Math.max(0, Math.min(1, score)) - expected))));
}
export function targetDifficulty(rating: number): number { return Math.max(1, Math.min(5, Math.round(rating / 300))); }
export function mutateAutomaton(reference: Automaton, seed: number, count: 1 | 2 = 1): { automaton: Automaton; edits: Edit[] } {
  const random = randomSource(seed);
  for (let trial = 0; trial < 30; trial++) {
    let automaton = reference;
    const edits: Edit[] = [];
    for (let i = 0; i < count; i++) {
      const state = reference.states[Math.floor(random() * reference.states.length)] ?? reference.start;
      const transition = automaton.transitions[Math.floor(random() * automaton.transitions.length)];
      const edit: Edit = transition && random() > .4 ? { type: 'changeTarget', ...transition, oldTo: transition.to, newTo: state } : { type: 'toggleFinal', state };
      automaton = applyEdit(automaton, edit); edits.push(edit);
    }
    if (!checkEquivalence(automaton, reference).equivalent) return { automaton, edits };
  }
  const edit: Edit = { type: 'toggleFinal', state: reference.start };
  return { automaton: applyEdit(reference, edit), edits: [edit] };
}
