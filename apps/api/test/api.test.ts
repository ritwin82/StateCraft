import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { Store } from '../src/store.js';
import { HintService, leaksSolution, safeFacts, fallbackHint } from '../src/hints.js';
import type { HintFacts } from '../src/hints.js';
import { applyEdit, checkEquivalence, generateQuestion, simulate } from '@tutor/engine';
const offline: typeof fetch = async () => { throw new Error('offline'); };
const reference = generateQuestion('ends', 2, 1).reference;
const facts: HintFacts = { question: 'Ends with a pattern', questionId: 'q', reference, result: { equivalent: false, counterexample: 'ab', shouldAccept: true }, edits: [{ type: 'toggleFinal', state: reference.start }], misconception: 'WRONG_FINAL_STATE', level: 1 };
describe('hint policy', () => {
  it('only sends facts appropriate to the requested level', () => {
    expect(safeFacts(facts)).not.toHaveProperty('reference');
    expect(safeFacts(facts)).not.toHaveProperty('verification');
    expect(safeFacts({ ...facts, level: 2 })).toHaveProperty('verification');
    expect(safeFacts({ ...facts, level: 3 })).not.toHaveProperty('verifiedEdits');
    expect(safeFacts({ ...facts, level: 4 })).toHaveProperty('verifiedEdits');
    expect(safeFacts({ ...facts, level: 5 })).toHaveProperty('reference');
  });
  it('rejects solution leakage across 100 generated adversarial fixtures', () => {
    let failures = 0;
    const leaks = ['transitions: [{ from: q0 }]', 'Change the accepting state.', 'q0 → q1', '| state | a | b |', '(q0,a,q1)', 'toggleFinal(q0)', 'Add transition q0 a q1'];
    for (let i = 0; i < 100; i++) if (!leaksSolution(`${leaks[i % leaks.length]} ${i}`, 1 + i % 3, reference)) failures++;
    expect(failures).toBe(0);
    expect(leaksSolution('What information must a state remember?', 1, reference)).toBe(false);
  });
  it('falls back on failures and rejected output and caches by facts', async () => {
    const service = new HintService({ fetcher: offline });
    for (let level = 1; level <= 5; level++) expect((await service.get({ ...facts, level })).source).toBe('template');
    const malicious: typeof fetch = async () => new Response(JSON.stringify({ message: { content: 'Change the final state.' } }));
    expect((await new HintService({ fetcher: malicious }).get(facts)).source).toBe('template');
    let calls = 0;
    const good: typeof fetch = async () => { calls++; return new Response(JSON.stringify({ message: { content: 'What does the current state remember?' } })); };
    const cached = new HintService({ fetcher: good });
    expect((await cached.get(facts)).source).toBe('ollama'); await cached.get(facts); expect(calls).toBe(1);
    await cached.get({ ...facts, level: 2 }); expect(calls).toBe(2);
    expect(fallbackHint({ ...facts, result: { equivalent: true } })).toContain('exactly');
  });
});
describe('API integration', () => {
  it('supports registration, private progress, hints, scoring, debug, and role enforcement', async () => {
    const store = new Store(''); const app = createApp(store, new HintService({ fetcher: offline }));
    expect((await request(app).get('/api/health')).body.storage).toBe('memory');
    expect((await request(app).get('/api/progress')).status).toBe(401);
    const credentials = { name: 'Learner', email: 'learner@example.test', password: 'a-long-test-password', classCode: 'toc' };
    const registration = await request(app).post('/api/auth/register').send(credentials);
    expect(registration.status).toBe(200);
    const token: string = registration.body.token;
    for (const topic of ['nfa', 'enfa']) for (const difficulty of ['easy', 'medium', 'hard']) {
      const category = await request(app).get(`/api/questions/next?topic=${topic}&difficulty=${difficulty}`).auth(token, { type: 'bearer' });
      expect(category.status).toBe(200);
      expect(category.body.level).toBe(difficulty);
      const saved = await store.question(category.body.id);
      expect(saved?.reference.kind).toBe(topic === 'nfa' ? 'NFA' : 'ENFA');
      expect(generateQuestion(category.body.topic, category.body.difficulty, category.body.seed).id).toBe(category.body.id);
    }
    expect((await request(app).post('/api/auth/login').send({ ...credentials, password: 'incorrect-password' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send(credentials)).status).toBe(200);
    expect((await request(app).post('/api/auth/register').send(credentials)).status).toBe(409);
    const next = await request(app).get('/api/questions/next?topic=count').auth(token, { type: 'bearer' });
    expect(next.status).toBe(200); expect(next.body.reference).toBeUndefined();
    const question = await store.question(String(next.body.id)); if (!question) throw new Error('Missing question');
    const student = applyEdit(question.reference, { type: 'toggleFinal', state: question.reference.start });
    const hint = await request(app).post('/api/hints').auth(token, { type: 'bearer' }).send({ questionId: question.id, automaton: student, level: 2 });
    expect(hint.status).toBe(200); expect(hint.body.solution).toBeUndefined(); expect(hint.body.source).toBe('template');
    const attempt = await request(app).post('/api/attempts').auth(token, { type: 'bearer' }).send({ questionId: question.id, automaton: question.reference });
    expect(attempt.status).toBe(200); expect(attempt.body.result.equivalent).toBe(true); expect(attempt.body.attempt.score).toBe(.7);
    const progress = await request(app).get('/api/progress').auth(token, { type: 'bearer' });
    expect(progress.body.attempts).toHaveLength(1);
    expect((await request(app).get('/api/instructor').auth(token, { type: 'bearer' })).status).toBe(403);
    const debug = await request(app).post('/api/debug').auth(token, { type: 'bearer' }).send({ questionId: question.id });
    const result = checkEquivalence(debug.body.automaton, question.reference); if (result.equivalent) throw new Error('Debug machine unchanged');
    const witness = await request(app).post('/api/debug').auth(token, { type: 'bearer' }).send({ questionId: question.id, witness: result.counterexample });
    expect(witness.body.valid).toBe(true);
    expect(simulate(question.reference, result.counterexample).accepted).toBe(result.shouldAccept);
    const invalid = await request(app).post('/api/attempts').auth(token, { type: 'bearer' }).send({ questionId: question.id, automaton: { ...student, start: 'missing' } });
    expect(invalid.status).toBe(400);
    const other = await request(app).post('/api/auth/register').send({ ...credentials, email: 'other@example.test', role: 'instructor' });
    expect(other.body.user.role).toBe('student');
    expect((await request(app).get('/api/progress').auth(String(other.body.token), { type: 'bearer' })).body.attempts).toHaveLength(0);
    const stored = await store.user(credentials.email); expect(stored?.passwordHash).not.toContain(credentials.password);
  });
});
