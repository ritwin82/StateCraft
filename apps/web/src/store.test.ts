import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudio } from './store';
import { generateQuestion } from '@tutor/engine';
const initial = useStudio.getState();
beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  useStudio.setState({ ...initial, session: null, undo: [], selected: null, locked: false });
});
describe('workspace state regressions', () => {
  it('removes stale selection when undo deletes the selected state', () => {
    const s = useStudio.getState();
    s.setGraph({ ...s.automaton, states: [...s.automaton.states, 'added'] });
    s.select('added'); s.undoEdit();
    expect(useStudio.getState().selected).toBeNull();
    expect(useStudio.getState().automaton.states).not.toContain('added');
  });
  it('locks edits during construction but permits animation updates', () => {
    const original = useStudio.getState().automaton;
    const changed = { ...original, finals: [] };
    useStudio.setState({ locked: true });
    useStudio.getState().setGraph(changed);
    expect(useStudio.getState().automaton).toBe(original);
    useStudio.getState().setGraph(changed, false);
    expect(useStudio.getState().automaton).toBe(changed);
  });
  it('loads authenticated challenges through the API', async () => {
    const q = generateQuestion('ends', 3, 111);
    const { reference, ...publicData } = q;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ...publicData, alphabet: reference.alphabet })));
    vi.stubGlobal('fetch', fetcher);
    useStudio.setState({ session: { token: 'test', user: { id: '1', name: 'Student', role: 'student', classCode: 'toc' } } });
    await useStudio.getState().newQuestion('ends');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(useStudio.getState().remoteQuestionId).toBe(q.id);
    expect(useStudio.getState().question.reference).toEqual(reference);
  });
  it('retains work on failed authenticated loading', async () => {
    const original = useStudio.getState().automaton;
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'offline' }), { status: 503 }));
    useStudio.setState({ session: { token: 'test', user: { id: '1', name: 'Student', role: 'student', classCode: 'toc' } } });
    await expect(useStudio.getState().newQuestion('count')).rejects.toThrow('offline');
    expect(useStudio.getState().automaton).toBe(original);
  });
  it('does not inflate mastery for repeated correct submissions', () => {
    useStudio.setState({ attempts: [], mastery: {} });
    useStudio.getState().recordAttempt({ equivalent: true }, 'UNKNOWN');
    const first = useStudio.getState().mastery;
    useStudio.getState().recordAttempt({ equivalent: true }, 'UNKNOWN');
    expect(useStudio.getState().mastery).toEqual(first);
    expect(useStudio.getState().attempts).toHaveLength(2);
  });
});
