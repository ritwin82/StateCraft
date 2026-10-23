import type { Automaton, ValidationIssue, TraceStep, SimulationResult, SubsetResult, MinimizationResult } from './types.js';
export type * from './types.js';
export * from './verification.js';
export * from './diagnosis.js';
export * from './questions.js';
export * from './adaptive.js';

const EPSILON = 'ε';
const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();

export function validateAutomaton(a: Automaton): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, message: string): void => { issues.push({ code, message }); };
  if (!['DFA', 'NFA', 'ENFA'].includes(a.kind)) issue('KIND', 'Unknown automaton kind.');
  for (const [name, values] of [['states', a.states], ['alphabet', a.alphabet], ['finals', a.finals]] as const) {
    if (new Set(values).size !== values.length) issue('DUPLICATE', `Duplicate ${name}.`);
  }
  if (!a.states.length || a.states.some(s => !s.length)) issue('STATES', 'States must be nonempty identifiers.');
  if (!a.states.includes(a.start)) issue('START', 'Start state is unknown.');
  if (a.finals.some(s => !a.states.includes(s))) issue('FINAL', 'Final state is unknown.');
  if (a.alphabet.some(s => s === EPSILON || [...s].length !== 1)) issue('ALPHABET', 'Alphabet symbols must be single Unicode characters other than ε.');
  const seen = new Set<string>();
  const targets = new Map<string, string>();
  for (const t of a.transitions) {
    if (!a.states.includes(t.from) || !a.states.includes(t.to)) issue('STATE', 'Transition references an unknown state.');
    if (!(a.alphabet.includes(t.symbol) || (a.kind === 'ENFA' && t.symbol === EPSILON))) issue('SYMBOL', `Invalid transition symbol: ${t.symbol}`);
    const key = JSON.stringify([t.from, t.symbol, t.to]);
    if (seen.has(key)) issue('DUPLICATE_TRANSITION', 'Duplicate transition.');
    seen.add(key);
    const pair = JSON.stringify([t.from, t.symbol]);
    if (a.kind === 'DFA' && targets.has(pair) && targets.get(pair) !== t.to) issue('NONDETERMINISTIC', 'DFA has multiple targets for a state and symbol.');
    targets.set(pair, t.to);
  }
  return issues;
}

function assertValid(a: Automaton): void {
  const issues = validateAutomaton(a);
  if (issues.length) throw new Error(issues.map(i => `${i.code}: ${i.message}`).join('\n'));
}

function closure(a: Automaton, states: Iterable<string>): string[] {
  const reached = new Set(states);
  const queue = [...reached];
  for (const state of queue) {
    for (const t of a.transitions) {
      if (t.from === state && t.symbol === EPSILON && !reached.has(t.to)) {
        reached.add(t.to);
        queue.push(t.to);
      }
    }
  }
  return sorted(reached);
}

export function epsilonClosure(a: Automaton, states: Iterable<string>): string[] {
  assertValid(a);
  const seeds = [...states];
  if (seeds.some(s => !a.states.includes(s))) throw new Error('Unknown closure seed state.');
  return closure(a, seeds);
}

function move(a: Automaton, states: readonly string[], symbol: string): string[] {
  return sorted(a.transitions.filter(t => states.includes(t.from) && t.symbol === symbol).map(t => t.to));
}

export function simulate(a: Automaton, input: string | readonly string[]): SimulationResult {
  assertValid(a);
  const symbols = [...input];
  if (symbols.some(s => !a.alphabet.includes(s))) throw new Error('Input contains a symbol outside the alphabet.');
  let active = [a.start];
  const trace: TraceStep[] = [{ kind: 'start', symbol: null, activeStates: [...active] }];
  const expand = (): void => {
    if (a.kind !== 'ENFA') return;
    active = closure(a, active);
    trace.push({ kind: 'epsilon', symbol: EPSILON, activeStates: [...active] });
  };
  expand();
  for (const symbol of symbols) {
    active = move(a, active, symbol);
    trace.push({ kind: 'consume', symbol, activeStates: [...active] });
    expand();
  }
  return { accepted: active.some(s => a.finals.includes(s)), trace };
}

export function subsetConstruction(a: Automaton): SubsetResult {
  assertValid(a);
  const members = [closure(a, [a.start])];
  const ids = new Map<string, string>([[JSON.stringify(members[0]), 'D0']]);
  const result: SubsetResult = {
    automaton: { kind: 'DFA', states: [], alphabet: sorted(a.alphabet), start: 'D0', finals: [], transitions: [] },
    subsets: {}, steps: [],
  };
  for (const [index, subset] of members.entries()) {
    const from = `D${index}`;
    result.automaton.states.push(from);
    result.subsets[from] = [...subset];
    if (subset.some(s => a.finals.includes(s))) result.automaton.finals.push(from);
    for (const symbol of result.automaton.alphabet) {
      const next = closure(a, move(a, subset, symbol));
      const key = JSON.stringify(next);
      let to = ids.get(key);
      const discovered = to === undefined;
      if (to === undefined) {
        to = `D${members.length}`;
        ids.set(key, to);
        members.push(next);
      }
      result.automaton.transitions.push({ from, symbol, to });
      result.steps.push({ from, symbol, to, members: [...next], discovered });
    }
  }
  return result;
}

export function completeDfa(a: Automaton): Automaton {
  assertValid(a);
  if (a.kind !== 'DFA') throw new Error('Expected a DFA.');
  const result: Automaton = { ...a, states: [...a.states], alphabet: [...a.alphabet], finals: [...a.finals], transitions: a.transitions.map(t => ({ ...t })) };
  let dead = '__dead';
  while (a.states.includes(dead)) dead += '_';
  for (const from of a.states) {
    for (const symbol of a.alphabet) {
      if (!a.transitions.some(t => t.from === from && t.symbol === symbol)) result.transitions.push({ from, symbol, to: dead });
    }
  }
  if (result.transitions.length !== a.transitions.length) {
    result.states.push(dead);
    for (const symbol of a.alphabet) result.transitions.push({ from: dead, symbol, to: dead });
  }
  return result;
}

export function minimizeDfa(a: Automaton): MinimizationResult {
  const dfa = completeDfa(a);
  const target = (state: string, symbol: string): string => {
    const t = dfa.transitions.find(t => t.from === state && t.symbol === symbol);
    if (!t) throw new Error('Internal error: incomplete DFA.');
    return t.to;
  };
  const reachable = new Set([dfa.start]);
  for (const state of reachable) for (const symbol of dfa.alphabet) reachable.add(target(state, symbol));
  let blocks = [sorted([...reachable].filter(s => dfa.finals.includes(s))), sorted([...reachable].filter(s => !dfa.finals.includes(s)))].filter(b => b.length);
  const snapshots = (): string[][] => blocks.map(b => [...b]);
  const partitions = [snapshots()];
  const states = sorted(reachable);
  const pairKey = (left: string, right: string): string => JSON.stringify([left, right].sort());
  const pairs = states.flatMap((left, i) => states.slice(i + 1).map(right => [left, right] as const));
  const marked = new Set(pairs.filter(([left, right]) => dfa.finals.includes(left) !== dfa.finals.includes(right)).map(([left, right]) => pairKey(left, right)));
  // Synchronous table-filling rounds expose distinguishability by increasing suffix length.
  while (true) {
    const newlyMarked = pairs.filter(([left, right]) =>
      !marked.has(pairKey(left, right)) && dfa.alphabet.some(symbol => marked.has(pairKey(target(left, symbol), target(right, symbol))))
    );
    if (!newlyMarked.length) break;
    for (const [left, right] of newlyMarked) marked.add(pairKey(left, right));
    const next: string[][] = [];
    for (const state of states) {
      const block = next.find(group => group.every(member => !marked.has(pairKey(state, member))));
      if (block) block.push(state);
      else next.push([state]);
    }
    blocks = next;
    partitions.push(snapshots());
  }
  const id = (state: string): string => `M${blocks.findIndex(b => b.includes(state))}`;
  const automaton: Automaton = { kind: 'DFA', states: blocks.map((_, i) => `M${i}`), alphabet: [...dfa.alphabet], start: id(dfa.start), finals: [], transitions: [] };
  for (const block of blocks) {
    const representative = block[0];
    if (representative === undefined) throw new Error('Internal error: empty partition.');
    if (dfa.finals.includes(representative)) automaton.finals.push(id(representative));
    for (const symbol of dfa.alphabet) automaton.transitions.push({ from: id(representative), symbol, to: id(target(representative, symbol)) });
  }
  return { automaton, partitions };
}
