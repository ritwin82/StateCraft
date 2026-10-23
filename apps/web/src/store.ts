import { create } from 'zustand';
import { generateQuestion, mutateAutomaton, updateMastery, targetDifficulty, wordAutomaton } from '@tutor/engine';
import type { Automaton, Question, Topic, EquivalenceResult } from '@tutor/engine';
export type Attempt = { id: string; questionId: string; topic: string; correct: boolean; score: number; hintLevel: number; misconception: string; createdAt: string };
export type Session = { token: string; user: { id: string; name: string; role: string; classCode: string } };
export type Position = { x: number; y: number };
const initialQuestion: Question = { id: 'intro-ends-ab', topic: 'ends', prompt: 'Build an automaton that accepts exactly the strings that end with “ab”.', reference: wordAutomaton('ends', 'ab'), difficulty: 2, level: 'easy', seed: 12, minimalStates: 3, nfaSmaller: false };
const starter: Automaton = { kind: 'DFA', states: ['q0', 'q1', 'q2'], alphabet: ['a', 'b'], start: 'q0', finals: ['q2'], transitions: [{ from: 'q0', symbol: 'a', to: 'q1' }, { from: 'q0', symbol: 'b', to: 'q0' }, { from: 'q1', symbol: 'a', to: 'q1' }, { from: 'q1', symbol: 'b', to: 'q2' }, { from: 'q2', symbol: 'b', to: 'q0' }] };
let questionRequest = 0;
function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T ?? fallback; } catch { return fallback; } }
export function layout(a: Automaton): Record<string, Position> { return Object.fromEntries(a.states.map((s, i) => [s, { x: 90 + i % 4 * 180, y: 150 + Math.floor(i / 4) * 155 }])); }
type State = {
  automaton: Automaton; positions: Record<string, Position>; selected: string | null; question: Question;
  undo: Automaton[]; result: EquivalenceResult | null; attempts: Attempt[]; mastery: Record<string, number>;
  mode: 'practice' | 'debug'; faulty: Automaton | null; witnessVerified: boolean; hintLevel: number;
  difficultyChoice: 'adaptive' | 'easy' | 'medium' | 'hard'; session: Session | null; remoteQuestionId: string | null; locked: boolean;
  setGraph: (a: Automaton, record?: boolean) => void; setPosition: (state: string, position: Position) => void;
  select: (state: string | null) => void; undoEdit: () => void; newQuestion: (topic?: Topic, mode?: 'practice' | 'debug', difficultyChoice?: State['difficultyChoice']) => Promise<void>;
  recordAttempt: (result: EquivalenceResult, misconception: string) => void;
  setSession: (session: Session | null) => void;
};
export const useStudio = create<State>((set, get) => ({
  automaton: starter, positions: layout(starter), selected: null, question: initialQuestion, undo: [], result: null,
  attempts: read<Attempt[]>('statecraft-attempts', []), mastery: read<Record<string, number>>('statecraft-mastery', {}),
  difficultyChoice: 'adaptive', mode: 'practice', faulty: null, witnessVerified: false, hintLevel: 0, session: read<Session | null>('statecraft-session', null), remoteQuestionId: null, locked: false,
  setGraph: (a, record = true) => set(s => s.locked && record ? {} : ({ automaton: a, result: null, selected: a.states.includes(s.selected ?? '') ? s.selected : null, undo: record ? [...s.undo.slice(-29), s.automaton] : s.undo, positions: { ...layout(a), ...s.positions } })),
  setPosition: (state, position) => set(s => ({ positions: { ...s.positions, [state]: position } })),
  select: selected => set({ selected }),
  undoEdit: () => { const s = get(); const a = s.undo.at(-1); if (a && !s.locked) set({ automaton: a, undo: s.undo.slice(0, -1), selected: a.states.includes(s.selected ?? '') ? s.selected : null, result: null }); },
  newQuestion: async (topic, mode = get().mode, difficultyChoice = get().difficultyChoice) => {
    const requestId = ++questionRequest;
    const s = get(); const chosen = topic ?? s.question.topic;
    let question = generateQuestion(chosen, difficultyChoice === 'adaptive' ? targetDifficulty(s.mastery[chosen] ?? 900) : difficultyChoice === 'easy' ? 2 : difficultyChoice === 'medium' ? 3 : 4, Math.floor(Math.random() * 100000));
    let remoteQuestionId: string | null = null;
    if (s.session) {
      const q = await api<Omit<Question, 'reference'> & { alphabet: string[] }>(`/questions/next?topic=${chosen}&difficulty=${difficultyChoice}`);
      question = generateQuestion(q.topic, q.difficulty, q.seed, q.id.startsWith('v2-') ? 'v2' : 'v1');
      if (question.id !== q.id) throw new Error('Question version mismatch. Refresh the application.');
      remoteQuestionId = q.id;
    }
    const faulty = mode === 'debug' ? mutateAutomaton(question.reference, question.seed, 2).automaton : null;
    const automaton: Automaton = faulty ?? { kind: chosen === 'nfa' ? 'NFA' : chosen === 'enfa' ? 'ENFA' : s.automaton.kind, states: ['q0'], alphabet: question.reference.alphabet, start: 'q0', finals: [], transitions: [] };
    if (requestId === questionRequest) set({ difficultyChoice, question, automaton, positions: layout(automaton), selected: null, undo: [], result: null, hintLevel: 0, mode, faulty, witnessVerified: false, remoteQuestionId, locked: false });
  },
  recordAttempt: (result, misconception) => {
    const s = get(); const score = result.equivalent ? Math.max(.2, 1 - s.hintLevel * .15) : 0;
    const attempt: Attempt = { id: crypto.randomUUID(), questionId: s.question.id, topic: s.question.topic, correct: result.equivalent, score, hintLevel: s.hintLevel, misconception, createdAt: new Date().toISOString() };
    const solved = s.attempts.some(a => a.questionId === s.question.id && a.correct);
    const mastery = { ...s.mastery, [s.question.topic]: solved ? s.mastery[s.question.topic] ?? 900 : updateMastery(s.mastery[s.question.topic] ?? 900, s.question.difficulty, score) };
    const attempts = [attempt, ...s.attempts].slice(0, 200);
    localStorage.setItem('statecraft-attempts', JSON.stringify(attempts)); localStorage.setItem('statecraft-mastery', JSON.stringify(mastery));
    set({ attempts, mastery, result });
  },
  setSession: session => { if (session) localStorage.setItem('statecraft-session', JSON.stringify(session)); else localStorage.removeItem('statecraft-session'); set({ session }); },
}));
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const token = useStudio.getState().session?.token;
  const response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : 'Request failed.');
  return data as T;
}
