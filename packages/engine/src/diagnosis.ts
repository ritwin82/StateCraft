import type { Automaton } from './types.js';
import { checkEquivalence } from './verification.js';
import { validateAutomaton } from './index.js';
import { wordAutomaton } from './questions.js';

export type Edit =
  | { type: 'toggleFinal'; state: string }
  | { type: 'addState'; state: string }
  | { type: 'changeTarget'; from: string; symbol: string; oldTo: string; newTo: string }
  | { type: 'addTransition' | 'removeTransition'; from: string; symbol: string; to: string };
export type Misconception = 'MISSING_DEAD_STATE' | 'WRONG_FINAL_STATE' | 'CONTAINS_VS_ENDS_WITH' | 'OFF_BY_ONE_COUNT' | 'NFA_IN_DFA' | 'WRONG_TARGET' | 'UNKNOWN';
export function applyEdit(a: Automaton, edit: Edit): Automaton {
  const result: Automaton = { ...a, states: [...a.states], alphabet: [...a.alphabet], finals: [...a.finals], transitions: a.transitions.map(t => ({ ...t })) };
  if (edit.type === 'toggleFinal') result.finals = a.finals.includes(edit.state) ? a.finals.filter(s => s !== edit.state) : [...a.finals, edit.state];
  if (edit.type === 'addState' && !a.states.includes(edit.state)) result.states.push(edit.state);
  if (edit.type === 'changeTarget') result.transitions = result.transitions.map(t => t.from === edit.from && t.symbol === edit.symbol && t.to === edit.oldTo ? { ...t, to: edit.newTo } : t);
  if (edit.type === 'removeTransition') result.transitions = result.transitions.filter(t => !(t.from === edit.from && t.symbol === edit.symbol && t.to === edit.to));
  if (edit.type === 'addTransition' && !result.transitions.some(t => t.from === edit.from && t.symbol === edit.symbol && t.to === edit.to)) result.transitions.push({ from: edit.from, symbol: edit.symbol, to: edit.to });
  return result;
}
function* edits(a: Automaton): Generator<Edit> {
  for (const state of a.states) yield { type: 'toggleFinal', state };
  for (const t of a.transitions) {
    for (const newTo of a.states) if (t.to !== newTo) yield { type: 'changeTarget', ...t, oldTo: t.to, newTo };
    yield { type: 'removeTransition', ...t };
  }
  for (const from of a.states) for (const symbol of [...a.alphabet, ...(a.kind === 'ENFA' ? ['ε'] : [])]) {
    if (a.kind === 'DFA' && a.transitions.some(t => t.from === from && t.symbol === symbol)) continue;
    for (const to of a.states) if (!a.transitions.some(t => t.from === from && t.symbol === symbol && t.to === to)) yield { type: 'addTransition', from, symbol, to };
  }
  if (a.states.length < 6) {
    let state = 'trap';
    while (a.states.includes(state)) state += '_';
    yield { type: 'addState', state };
  }
}
export function diagnose(student: Automaton, reference: Automaton, options: { maxEdits?: 1 | 2; timeoutMs?: number } = {}): Edit[] | null {
  if (student.states.length > 6) return null;
  const deadline = Date.now() + (options.timeoutMs ?? 300);
  const matches = (a: Automaton): boolean => !validateAutomaton(a).length && checkEquivalence(a, reference, deadline).equivalent;
  try {
    if (matches(student)) return [];
    const first: { a: Automaton; edit: Edit }[] = [];
    const seen = new Set<string>();
    for (const edit of edits(student)) {
      if (Date.now() >= deadline) return null;
      const a = applyEdit(student, edit);
      if (matches(a)) return [edit];
      first.push({ a, edit });
    }
    if (options.maxEdits === 1) return null;
    for (const entry of first) for (const edit of edits(entry.a)) {
      if (Date.now() >= deadline) return null;
      const a = applyEdit(entry.a, edit);
      const key = JSON.stringify([a.states, [...a.finals].sort(), a.transitions.map(t => JSON.stringify(t)).sort()]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (matches(a)) return [entry.edit, edit];
    }
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'Search timed out.') throw error;
  }
  return null;
}
export function classifyMisconception(edits: Edit[] | null, student: Automaton, reference: Automaton): Misconception {
  if (!edits?.length) return 'UNKNOWN';
  if (edits.some(e => e.type === 'addState')) return 'MISSING_DEAD_STATE';
  if (student.kind === 'DFA' && edits.some(e => e.type === 'addTransition')) return 'NFA_IN_DFA';
  // Semantic labels need structural evidence; never infer a student's intent from one edit.
  const absorbingFinals = (a: Automaton): boolean => a.finals.length > 0 && a.finals.every(s => a.alphabet.every(x => a.transitions.some(t => t.from === s && t.symbol === x && a.finals.includes(t.to))));
  if (edits.some(e => e.type === 'changeTarget') && absorbingFinals(student) !== absorbingFinals(reference) && reference.alphabet.length <= 2) {
    let words = [''];
    for (let length = 1; length <= 3; length++) {
      words = words.flatMap(prefix => reference.alphabet.map(symbol => prefix + symbol));
      for (const word of words) {
        const contains = wordAutomaton('contains', word, reference.alphabet), ends = wordAutomaton('ends', word, reference.alphabet);
        const absorbing = absorbingFinals(student) ? student : reference;
        const other = absorbingFinals(student) ? reference : student;
        if (checkEquivalence(absorbing, contains).equivalent && checkEquivalence(other, ends).equivalent) return 'CONTAINS_VS_ENDS_WITH';
      }
    }
  }
  const unaryCycle = (a: Automaton): boolean => a.alphabet.length === 1 && a.states.every(s => a.transitions.filter(t => t.to === s).length === 1) && a.transitions.length === a.states.length;
  if (unaryCycle(student) && unaryCycle(reference) && edits.every(e => e.type === 'toggleFinal')) return 'OFF_BY_ONE_COUNT';
  if (edits.some(e => e.type === 'toggleFinal')) return 'WRONG_FINAL_STATE';
  if (edits.some(e => e.type === 'changeTarget')) return 'WRONG_TARGET';
  return 'UNKNOWN';
}
