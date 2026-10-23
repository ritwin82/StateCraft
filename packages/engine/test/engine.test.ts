import { describe, expect, it } from 'vitest';
import { completeDfa, epsilonClosure, minimizeDfa, simulate, subsetConstruction, validateAutomaton } from '../src/index.js';
import type { Automaton } from '../src/index.js';
import { enumerateStrings } from './helpers.js';

const even: Automaton = {
  kind: 'DFA', states: ['even', 'odd'], alphabet: ['a', 'b'], start: 'even', finals: ['even'],
  transitions: [
    { from: 'even', symbol: 'a', to: 'odd' }, { from: 'odd', symbol: 'a', to: 'even' },
    { from: 'even', symbol: 'b', to: 'even' }, { from: 'odd', symbol: 'b', to: 'odd' },
  ],
};
const enfa: Automaton = {
  kind: 'ENFA', states: ['s', 'p', 'f'], alphabet: ['a', 'b'], start: 's', finals: ['f'],
  transitions: [
    { from: 's', symbol: 'ε', to: 'p' }, { from: 'p', symbol: 'ε', to: 's' },
    { from: 'p', symbol: 'a', to: 'p' }, { from: 'p', symbol: 'a', to: 'f' },
    { from: 'f', symbol: 'b', to: 'f' },
  ],
};
const nfa: Automaton = { ...enfa, kind: 'NFA', start: 'p', transitions: enfa.transitions.filter(t => t.symbol !== 'ε') };
const partial: Automaton = { kind: 'DFA', states: ['s'], alphabet: ['a'], start: 's', finals: ['s'], transitions: [] };

describe('validation', () => {
  it.each([even, enfa, nfa, partial])('accepts valid $kind including partial DFAs', a => expect(validateAutomaton(a)).toEqual([]));
  it.each<[Partial<Automaton>, string]>([
    [{ states: [] }, 'STATES'], [{ states: ['even', 'even'] }, 'DUPLICATE'],
    [{ start: 'missing' }, 'START'], [{ finals: ['missing'] }, 'FINAL'],
    [{ finals: ['even', 'even'] }, 'DUPLICATE'], [{ alphabet: ['a', 'a'] }, 'DUPLICATE'],
    [{ alphabet: ['ε'] }, 'ALPHABET'], [{ alphabet: ['ab'] }, 'ALPHABET'],
    [{ alphabet: [''] }, 'ALPHABET'], [{ states: ['', 'even', 'odd'] }, 'STATES'],
    [{ transitions: [{ from: 'missing', symbol: 'a', to: 'even' }] }, 'STATE'],
    [{ transitions: [{ from: 'even', symbol: 'a', to: 'missing' }] }, 'STATE'],
    [{ transitions: [{ from: 'even', symbol: 'c', to: 'even' }] }, 'SYMBOL'],
    [{ transitions: [{ from: 'even', symbol: 'ε', to: 'even' }] }, 'SYMBOL'],
    [{ transitions: [...even.transitions, { from: 'even', symbol: 'a', to: 'even' }] }, 'NONDETERMINISTIC'],
    [{ transitions: [...even.transitions, { from: 'even', symbol: 'a', to: 'odd' }] }, 'DUPLICATE_TRANSITION'],
  ])('reports invalid structure %#', (patch, code) => expect(validateAutomaton({ ...even, ...patch }).map(i => i.code)).toContain(code));
  it('rejects epsilon in NFA', () => expect(validateAutomaton({ ...enfa, kind: 'NFA' }).map(i => i.code)).toContain('SYMBOL'));
});

describe('closure and simulation', () => {
  it('terminates on cycles and deduplicates seeds', () => {
    expect(epsilonClosure(enfa, ['s', 's'])).toEqual(['p', 's']);
    expect(epsilonClosure(enfa, [])).toEqual([]);
    expect(epsilonClosure(even, ['odd'])).toEqual(['odd']);
    expect(() => epsilonClosure(enfa, ['unknown'])).toThrow();
  });
  it('records DFA steps', () => {
    expect(simulate(even, 'aba')).toEqual({ accepted: true, trace: [
      { kind: 'start', symbol: null, activeStates: ['even'] },
      { kind: 'consume', symbol: 'a', activeStates: ['odd'] },
      { kind: 'consume', symbol: 'b', activeStates: ['odd'] },
      { kind: 'consume', symbol: 'a', activeStates: ['even'] },
    ] });
    expect(simulate(even, 'a').accepted).toBe(false);
    expect(simulate(even, '').accepted).toBe(true);
  });
  it('records branching NFA active sets', () => {
    expect(simulate(nfa, 'ab').trace.map(s => s.activeStates)).toEqual([['p'], ['f', 'p'], ['f']]);
    expect(simulate(nfa, 'ab').accepted).toBe(true);
  });
  it('records initial and post-consumption epsilon closures', () => {
    const result = simulate(enfa, 'a');
    expect(result.trace.map(s => s.kind)).toEqual(['start', 'epsilon', 'consume', 'epsilon']);
    expect(result.trace.map(s => s.activeStates)).toEqual([['s'], ['p', 's'], ['f', 'p'], ['f', 'p', 's']]);
    expect(result.accepted).toBe(true);
    expect(simulate({ ...enfa, finals: ['p'] }, '').accepted).toBe(true);
  });
  it('follows epsilon paths after the last symbol', () => {
    const a: Automaton = { ...enfa, transitions: [{ from: 's', symbol: 'a', to: 'p' }, { from: 'p', symbol: 'ε', to: 'f' }] };
    expect(simulate(a, 'a').accepted).toBe(true);
  });
  it('handles missing transitions, no finals, and invalid input', () => {
    expect(simulate(partial, 'aa').trace.map(s => s.activeStates)).toEqual([['s'], [], []]);
    expect(simulate({ ...even, finals: [] }, '').accepted).toBe(false);
    expect(() => simulate(even, 'c')).toThrow();
    expect(() => simulate(enfa, 'ε')).toThrow();
    expect(simulate(even, ['a', 'a']).accepted).toBe(true);
  });
  it('treats Unicode code points as symbols', () => {
    const a: Automaton = { ...partial, alphabet: ['😀'], transitions: [{ from: 's', symbol: '😀', to: 's' }] };
    expect(validateAutomaton(a)).toEqual([]);
    expect(simulate(a, '😀😀').accepted).toBe(true);
  });
});

describe('subset construction', () => {
  it.each([even, nfa, enfa, partial])('preserves $kind language through length six', a => {
    const result = subsetConstruction(a);
    expect(validateAutomaton(result.automaton)).toEqual([]);
    expect(result.automaton.transitions).toHaveLength(result.automaton.states.length * a.alphabet.length);
    for (const word of enumerateStrings(a.alphabet, 6)) expect(simulate(result.automaton, word).accepted).toBe(simulate(a, word).accepted);
    expect(result.steps.map(({ from, symbol, to }) => ({ from, symbol, to }))).toEqual(result.automaton.transitions);
    expect(result.steps.filter(s => s.discovered)).toHaveLength(result.automaton.states.length - 1);
    expect(subsetConstruction(a)).toEqual(result);
  });
  it('includes the empty subset and gives it self loops', () => {
    const result = subsetConstruction(partial);
    expect(result.subsets).toEqual({ D0: ['s'], D1: [] });
    expect(result.automaton.transitions).toContainEqual({ from: 'D1', symbol: 'a', to: 'D1' });
  });
  it('handles state identifiers containing delimiters', () => {
    const a: Automaton = { kind: 'NFA', states: ['a,b', 'a', 'b'], start: 'a,b', finals: ['b'], alphabet: ['x'], transitions: [{ from: 'a,b', symbol: 'x', to: 'a' }, { from: 'a,b', symbol: 'x', to: 'b' }] };
    expect(Object.values(subsetConstruction(a).subsets)).toEqual([['a,b'], ['a', 'b'], []]);
  });
});

describe('completion and minimization', () => {
  it('adds a nonfinal dead state without name collisions', () => {
    const a = { ...partial, states: ['s', '__dead'] };
    const result = completeDfa(a);
    expect(result.states).toEqual(['s', '__dead', '__dead_']);
    expect(result.transitions).toHaveLength(3);
    expect(result.finals).toEqual(['s']);
    expect(completeDfa(result)).toEqual(result);
    expect(completeDfa(even)).toEqual(even);
    for (const word of enumerateStrings(a.alphabet, 5)) expect(simulate(a, word).accepted).toBe(simulate(result, word).accepted);
  });
  it('merges equivalent states and removes unreachable states', () => {
    const a: Automaton = { kind: 'DFA', states: ['s', 'f', 'g', 'unreachable'], start: 's', finals: ['f', 'g'], alphabet: ['a', 'b'], transitions: [
      { from: 's', symbol: 'a', to: 'f' }, { from: 's', symbol: 'b', to: 'g' },
      ...['f', 'g'].flatMap(from => ['a', 'b'].map(symbol => ({ from, symbol, to: from }))),
    ] };
    const result = minimizeDfa(a);
    expect(result.automaton.states).toHaveLength(2);
    expect(result.partitions[0]).toEqual([['f', 'g'], ['s']]);
    for (const word of enumerateStrings(a.alphabet, 6)) expect(simulate(result.automaton, word).accepted).toBe(simulate(a, word).accepted);
  });
  it('records successive partition refinements', () => {
    const a: Automaton = { kind: 'DFA', states: ['0', '1', '2', '3'], alphabet: ['a'], start: '0', finals: ['3'], transitions: ['0', '1', '2', '3'].map((from, i) => ({ from, symbol: 'a', to: String(Math.min(i + 1, 3)) })) };
    const result = minimizeDfa(a);
    expect(result.partitions.map(p => p.length)).toEqual([2, 3, 4]);
    expect(result.automaton.states).toHaveLength(4);
    expect(minimizeDfa(result.automaton).automaton.states).toHaveLength(4);
  });
  it.each([{ finals: [] }, { finals: ['even', 'odd'] }])('collapses uniform acceptance to one state', ({ finals }) => {
    expect(minimizeDfa({ ...even, finals }).automaton.states).toHaveLength(1);
  });
  it.each([{ finals: [] }, { finals: ['s'] }])('handles an empty alphabet', ({ finals }) => {
    const a: Automaton = { ...partial, alphabet: [], finals };
    expect(completeDfa(a)).toEqual(a);
    expect(subsetConstruction(a).automaton.states).toHaveLength(1);
    expect(minimizeDfa(a).automaton.states).toHaveLength(1);
    expect(simulate(a, '').accepted).toBe(finals.length > 0);
  });
  it('rejects nondeterministic inputs to DFA-only operations', () => {
    expect(() => completeDfa(nfa)).toThrow();
    expect(() => minimizeDfa(enfa)).toThrow();
  });
});

describe('contracts and test oracle', () => {
  it('enumerates length then lexical order', () => {
    expect(enumerateStrings(['b', 'a'], 2)).toEqual(['', 'a', 'b', 'aa', 'ab', 'ba', 'bb']);
    expect(enumerateStrings([], 5)).toEqual(['']);
    expect(enumerateStrings(['a'], 0)).toEqual(['']);
    expect(() => enumerateStrings(['a'], -1)).toThrow();
    expect(() => enumerateStrings(['a'], 1.5)).toThrow();
    expect(() => enumerateStrings(['a', 'a'], 2)).toThrow();
    expect(() => enumerateStrings(['ab'], 2)).toThrow();
  });
  it('rejects invalid automata across all entry points', () => {
    const a = { ...even, start: 'missing' };
    for (const run of [() => epsilonClosure(a, []), () => simulate(a, ''), () => subsetConstruction(a), () => completeDfa(a), () => minimizeDfa(a)]) expect(run).toThrow();
  });
  it('does not mutate input objects', () => {
    const a = structuredClone(even);
    for (const t of a.transitions) Object.freeze(t);
    Object.freeze(a.transitions); Object.freeze(a.states); Object.freeze(a.alphabet); Object.freeze(a.finals); Object.freeze(a);
    simulate(a, 'aa'); epsilonClosure(a, ['even']); subsetConstruction(a); completeDfa(a); minimizeDfa(a);
    expect(a).toEqual(even);
  });
});
