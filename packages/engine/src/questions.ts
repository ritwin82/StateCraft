import type { Automaton } from './types.js';
import { minimizeDfa } from './index.js';
import { asDfa, checkEquivalence } from './verification.js';
export const topics = ['ends', 'starts', 'contains', 'count', 'length', 'union', 'intersection', 'complement'] as const;
export type Topic = typeof topics[number];
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export function difficultyLevel(difficulty: number): DifficultyLevel {
  return difficulty <= 2 ? 'easy' : difficulty === 3 ? 'medium' : 'hard';
}
export const QUESTION_BANK_SIZE = 120;
export type Question = { id: string; topic: Topic; prompt: string; reference: Automaton; difficulty: number; level: DifficultyLevel; seed: number; minimalStates: number; nfaSmaller: boolean };
export function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
export function wordAutomaton(mode: 'ends' | 'starts' | 'contains', word: string, alphabet = ['a', 'b']): Automaton {
  const letters = [...word];
  if (!letters.length || letters.some(s => !alphabet.includes(s))) throw new Error('Word must be nonempty and use the alphabet.');
  const n = letters.length;
  const states = Array.from({ length: n + 1 + (mode === 'starts' ? 1 : 0) }, (_, i) => `q${i}`);
  const transitions: Automaton['transitions'] = [];
  for (let i = 0; i < states.length; i++) for (const symbol of alphabet) {
    let next: number;
    if (mode === 'starts') next = i >= n ? i : symbol === letters[i] ? i + 1 : n + 1;
    else if (mode === 'contains' && i === n) next = n;
    else {
      const suffix = letters.slice(0, i).join('') + symbol;
      next = n;
      while (next > 0 && !suffix.endsWith(letters.slice(0, next).join(''))) next--;
    }
    transitions.push({ from: `q${i}`, symbol, to: `q${next}` });
  }
  return { kind: 'DFA', states, alphabet: [...alphabet], start: 'q0', finals: [`q${n}`], transitions };
}
export function moduloAutomaton(k: number, remainder: number, symbol: string | null, alphabet = ['a', 'b']): Automaton {
  if (!Number.isInteger(k) || k < 1 || k > 12 || !Number.isInteger(remainder) || remainder < 0 || remainder >= k || (symbol !== null && !alphabet.includes(symbol))) throw new Error('Invalid modulo parameters.');
  const states = Array.from({ length: k }, (_, i) => `q${i}`);
  return { kind: 'DFA', states, alphabet: [...alphabet], start: 'q0', finals: [`q${remainder}`], transitions: states.flatMap((from, i) => alphabet.map(x => ({ from, symbol: x, to: `q${(i + (symbol === null || symbol === x ? 1 : 0)) % k}` }))) };
}
export function combineAutomata(left: Automaton, right: Automaton, operation: 'union' | 'intersection'): Automaton {
  const alphabet = [...new Set([...left.alphabet, ...right.alphabet])].sort();
  const a = asDfa(left, alphabet), b = asDfa(right, alphabet);
  const pairs: [string, string][] = [[a.start, b.start]];
  const ids = new Map([[JSON.stringify(pairs[0]), 'q0']]);
  const result: Automaton = { kind: 'DFA', states: [], alphabet, start: 'q0', finals: [], transitions: [] };
  for (const [i, [l, r]] of pairs.entries()) {
    const from = `q${i}`;
    result.states.push(from);
    if (operation === 'union' ? a.finals.includes(l) || b.finals.includes(r) : a.finals.includes(l) && b.finals.includes(r)) result.finals.push(from);
    for (const symbol of alphabet) {
      const lt = a.transitions.find(t => t.from === l && t.symbol === symbol)?.to;
      const rt = b.transitions.find(t => t.from === r && t.symbol === symbol)?.to;
      if (lt === undefined || rt === undefined) throw new Error('Incomplete product.');
      const key = JSON.stringify([lt, rt]);
      let to = ids.get(key);
      if (to === undefined) { to = `q${pairs.length}`; ids.set(key, to); pairs.push([lt, rt]); }
      result.transitions.push({ from, symbol, to });
    }
  }
  return result;
}
export function complementAutomaton(a: Automaton): Automaton {
  const dfa = asDfa(a);
  return { ...dfa, finals: dfa.states.filter(s => !dfa.finals.includes(s)) };
}
export function generateQuestion(topic: Topic, targetDifficulty: number, seed: number, version: 'v1' | 'v2' = 'v2'): Question {
  if (!topics.includes(topic) || !Number.isFinite(targetDifficulty)) throw new Error('Invalid question parameters.');
  const random = randomSource(seed);
  let best: Question | undefined;
  for (let attempt = 0; attempt < 16; attempt++) {
    const combined = topic === 'union' || topic === 'intersection' || topic === 'complement';
    const length = 1 + Math.floor(random() * (version === 'v1' || combined ? 4 : 8));
    const word = Array.from({ length }, () => random() < .5 ? 'a' : 'b').join('');
    const k = 2 + Math.floor(random() * (version === 'v1' || combined ? 4 : 8)), r = Math.floor(random() * k);
    let reference: Automaton, prompt: string, nfaBound = Infinity;
    if (topic === 'ends' || topic === 'starts' || topic === 'contains') {
      reference = wordAutomaton(topic, word);
      prompt = `Build an automaton that accepts exactly the strings that ${topic === 'ends' ? 'end with' : topic === 'starts' ? 'start with' : 'contain'} “${word}”.`;
      nfaBound = length + 1;
    } else if (topic === 'count' || topic === 'length') {
      reference = moduloAutomaton(k, r, topic === 'count' ? 'a' : null);
      prompt = `Build an automaton that accepts exactly the strings whose ${topic === 'count' ? 'number of a symbols' : 'length'} is congruent to ${r} modulo ${k}.`;
    } else {
      const first = wordAutomaton('ends', word), second = moduloAutomaton(k, r, 'a');
      const combination = combineAutomata(first, second, topic === 'intersection' ? 'intersection' : 'union');
      reference = topic === 'complement' ? complementAutomaton(combination) : combination;
      prompt = topic === 'complement' ? `Accept strings that neither end with “${word}” nor have a count of a congruent to ${r} modulo ${k}.` : `Accept strings that end with “${word}” ${topic === 'union' ? 'OR' : 'AND'} have a count of a congruent to ${r} modulo ${k}.`;
      if (topic === 'union') nfaBound = length + 1 + k + 1;
    }
    reference = minimizeDfa(reference).automaton;
    const minimalStates = reference.states.length;
    // Keep every reference constructible within the editor/API's 16-state DFA limit.
    if (version === 'v2' && minimalStates > 16) continue;
    const nfaSmaller = nfaBound < minimalStates;
    const complexity = minimalStates + Math.max(0, reference.alphabet.length - 2) * 2 + (nfaSmaller && minimalStates >= 8 ? 1 : 0);
    const difficulty = version === 'v1'
      ? Math.min(5, Math.max(1, Math.round(Math.log2(minimalStates + 1) + reference.alphabet.length / 4 + (nfaSmaller ? .5 : 0))))
      : complexity <= 4 ? 2 : complexity <= 7 ? 3 : complexity <= 12 ? 4 : 5;
    // Version IDs because changing candidate ranges must not overwrite older saved questions.
    const question: Question = { id: `${version === 'v2' ? 'v2-' : ''}${topic}-${seed}-${attempt}`, topic, seed, reference, prompt, difficulty, level: difficultyLevel(difficulty), minimalStates, nfaSmaller };
    if (!best || Math.abs(difficulty - targetDifficulty) < Math.abs(best.difficulty - targetDifficulty)) best = question;
  }
  if (!best) throw new Error('Question generation failed.');
  return best;
}
export function seedQuestions(): Question[] {
  const questions: Question[] = [];
  for (const topic of topics) {
    const accepted: Question[] = [];
    for (const target of [2, 3, 4]) {
      let count = 0;
      for (let seed = 100; seed < 2100 && count < 5; seed++) {
        const question = generateQuestion(topic, target, seed);
        if (difficultyLevel(question.difficulty) !== difficultyLevel(target)) continue;
        if (accepted.some(q => q.minimalStates === question.minimalStates && checkEquivalence(q.reference, question.reference).equivalent)) continue;
        accepted.push(question);
        count++;
      }
      if (count !== 5) throw new Error(`Could not fill ${topic}/${difficultyLevel(target)} question quota.`);
    }
    questions.push(...accepted);
  }
  return questions;
}
