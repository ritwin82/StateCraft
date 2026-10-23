import { describe, it, expect } from 'vitest';
import { checkEquivalence, simulate, randomSource, diagnose, applyEdit, classifyMisconception, wordAutomaton, moduloAutomaton, combineAutomata, complementAutomaton, generateQuestion, seedQuestions, mutateAutomaton, updateMastery, targetDifficulty, validateAutomaton, topics } from '../src/index.js';
import type { Automaton } from '../src/index.js';
import { enumerateStrings } from './helpers.js';
describe('equivalence', () => {
  it('returns the shortest lexically first witness, including empty', () => {
    const a = wordAutomaton('ends', 'a');
    expect(checkEquivalence(a, wordAutomaton('ends', 'b'))).toEqual({ equivalent: false, counterexample: 'a', shouldAccept: false });
    expect(checkEquivalence(a, { ...a, finals: [...a.states] })).toEqual({ equivalent: false, counterexample: '', shouldAccept: true });
    expect(checkEquivalence(a, a)).toEqual({ equivalent: true });
  });
  it('uses the union alphabet and supports epsilon cycles', () => {
    const a: Automaton = { kind: 'ENFA', states: ['s', 'f'], alphabet: ['a'], start: 's', finals: ['f'], transitions: [{ from: 's', symbol: 'ε', to: 'f' }, { from: 'f', symbol: 'ε', to: 's' }, { from: 'f', symbol: 'a', to: 'f' }] };
    const b: Automaton = { kind: 'DFA', states: ['x'], alphabet: ['a'], start: 'x', finals: ['x'], transitions: [{ from: 'x', symbol: 'a', to: 'x' }] };
    expect(checkEquivalence(a, b).equivalent).toBe(true);
    expect(checkEquivalence(b, { ...b, alphabet: ['a', 'b'], transitions: [...b.transitions, { from: 'x', symbol: 'b', to: 'x' }] })).toEqual({ equivalent: false, counterexample: 'b', shouldAccept: true });
  });
  it('agrees with exhaustive length-10 enumeration for 550 seeded random pairs', () => {
    const random = randomSource(42);
    const make = (): Automaton => {
      const states = Array.from({ length: 1 + Math.floor(random() * 3) }, (_, i) => `s${i}`);
      return { kind: 'DFA', states, alphabet: ['a', 'b'], start: 's0', finals: states.filter(() => random() < .5), transitions: states.flatMap(from => ['a', 'b'].map(symbol => ({ from, symbol, to: states[Math.floor(random() * states.length)] ?? 's0' }))) };
    };
    const words = enumerateStrings(['a', 'b'], 10);
    // Direct DFA oracle avoids using equivalence or subset construction in the expected result.
    const accepts = (a: Automaton, word: string): boolean => {
      let state = a.start;
      for (const symbol of word) state = a.transitions.find(t => t.from === state && t.symbol === symbol)?.to ?? '';
      return a.finals.includes(state);
    };
    for (let i = 0; i < 550; i++) {
      const a = make(), b = make();
      const witness = words.find(word => accepts(a, word) !== accepts(b, word));
      const actual = checkEquivalence(a, b);
      expect(actual.equivalent).toBe(witness === undefined);
      if (!actual.equivalent) expect(actual.counterexample).toBe(witness);
    }
  }, 30000);
});
describe('diagnosis and mutations', () => {
  it('uses language evidence for contains-versus-ends classification', () => {
    const reference = wordAutomaton('ends', 'ab'), student = wordAutomaton('contains', 'ab');
    const edits = diagnose(student, reference, { timeoutMs: 1000 });
    expect(classifyMisconception(edits, student, reference)).toBe('CONTAINS_VS_ENDS_WITH');
    const cyclic = moduloAutomaton(3, 0, null, ['a']);
    const shifted = { ...cyclic, finals: ['q1'] };
    expect(classifyMisconception(diagnose(shifted, cyclic), shifted, cyclic)).toBe('OFF_BY_ONE_COUNT');
  });
  it('finds minimal one and two edit repairs', () => {
    const reference = moduloAutomaton(3, 0, 'a');
    const student = applyEdit(reference, { type: 'toggleFinal', state: 'q1' });
    const edits = diagnose(student, reference);
    expect(edits).toHaveLength(1);
    expect(classifyMisconception(edits, student, reference)).toBe('WRONG_FINAL_STATE');
    const twice = applyEdit(student, { type: 'toggleFinal', state: 'q2' });
    expect(diagnose(twice, reference, { timeoutMs: 2000 })).toHaveLength(2);
    expect(diagnose(twice, reference, { maxEdits: 1 })).toBeNull();
    expect(diagnose(reference, reference)).toEqual([]);
    expect(diagnose(twice, reference, { timeoutMs: 0 })).toBeNull();
  });
  it('applies every edit kind and detects structural issues', () => {
    const a = wordAutomaton('ends', 'a');
    const t = a.transitions[0]; if (!t) throw new Error('fixture');
    const missing = applyEdit(a, { type: 'removeTransition', ...t });
    const repair = diagnose(missing, a);
    expect(classifyMisconception(repair, missing, a)).toBe('NFA_IN_DFA');
    expect(applyEdit(missing, { type: 'addTransition', ...t })).toEqual({ ...a, transitions: [...a.transitions.slice(1), t] });
    expect(applyEdit(a, { type: 'addState', state: 'trap' }).states).toContain('trap');
    expect(classifyMisconception([{ type: 'addState', state: 'trap' }], a, a)).toBe('MISSING_DEAD_STATE');
    expect(classifyMisconception(null, a, a)).toBe('UNKNOWN');
    expect(diagnose({ ...a, states: [...a.states, 'u', 'v', 'w', 'x', 'y'] }, a)).toBeNull();
  });
  it('reports equivalent-repair recovery on seeded mutations', () => {
    let recovered = 0;
    for (let seed = 0; seed < 40; seed++) {
      const reference = moduloAutomaton(3, seed % 3, 'a');
      const student = mutateAutomaton(reference, seed, seed % 2 ? 1 : 2).automaton;
      const edits = diagnose(student, reference, { timeoutMs: 1000 });
      if (edits && checkEquivalence(edits.reduce(applyEdit, student), reference).equivalent) recovered++;
    }
    console.log(`Diagnosis recovery: ${recovered}/40 (${recovered * 2.5}%). Equivalent alternate repairs count as correct.`);
    expect(recovered).toBe(40);
  }, 30000);
});
describe('question templates and adaptation', () => {
  it('matches independent language predicates', () => {
    for (const word of enumerateStrings(['a', 'b'], 6)) {
      for (const mode of ['ends', 'starts', 'contains'] as const) {
        const expected = mode === 'ends' ? word.endsWith('aba') : mode === 'starts' ? word.startsWith('aba') : word.includes('aba');
        expect(simulate(wordAutomaton(mode, 'aba'), word).accepted).toBe(expected);
      }
      const a = moduloAutomaton(3, 1, 'a'), b = moduloAutomaton(2, 0, null);
      const x = [...word].filter(s => s === 'a').length % 3 === 1, y = word.length % 2 === 0;
      expect(simulate(a, word).accepted).toBe(x);
      expect(simulate(b, word).accepted).toBe(y);
      expect(simulate(combineAutomata(a, b, 'union'), word).accepted).toBe(x || y);
      expect(simulate(combineAutomata(a, b, 'intersection'), word).accepted).toBe(x && y);
      expect(simulate(complementAutomaton(a), word).accepted).toBe(!x);
    }
  });
  it('generates deterministic valid questions', () => {
    for (const topic of topics) {
      expect(generateQuestion(topic, 3, 22)).toEqual(generateQuestion(topic, 3, 22));
      expect(validateAutomaton(generateQuestion(topic, 4, 34).reference)).toEqual([]);
    }
    expect(() => moduloAutomaton(0, 0, null)).toThrow();
    expect(() => wordAutomaton('ends', '')).toThrow();
  });
  it('updates mastery and maps it to appropriate difficulty', () => {
    expect(updateMastery(900, 3, 1)).toBeGreaterThan(900);
    expect(updateMastery(900, 3, 0)).toBeLessThan(900);
    expect(targetDifficulty(100)).toBe(1);
    expect(targetDifficulty(2000)).toBe(5);
    expect(randomSource(9)()).toBe(randomSource(9)());
  });
});
