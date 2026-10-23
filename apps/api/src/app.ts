import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { checkEquivalence, classifyMisconception, diagnose, generateQuestion, mutateAutomaton, simulate, targetDifficulty, topics, updateMastery, validateAutomaton } from '@tutor/engine';
import type { Automaton } from '@tutor/engine';
import { Store } from './store.js';
import { HintService } from './hints.js';
import { createChatRouter } from './chat.js';
const automatonSchema = z.object({ kind: z.enum(['DFA', 'NFA', 'ENFA']), states: z.array(z.string().min(1).max(32)).min(1).max(16), alphabet: z.array(z.string().min(1).max(2)).max(4), start: z.string(), finals: z.array(z.string()).max(16), transitions: z.array(z.object({ from: z.string(), symbol: z.string(), to: z.string() })).max(128) }).superRefine((a, ctx) => {
  if (a.kind !== 'DFA' && a.states.length > 8) ctx.addIssue({ code: 'custom', message: 'NFA and ε-NFA are limited to eight states for bounded verification.' });
  for (const issue of validateAutomaton(a)) ctx.addIssue({ code: 'custom', message: issue.message });
});
const credentials = z.object({ email: z.string().email().max(200).transform(s => s.toLowerCase()), password: z.string().min(10).max(128) });
const hashPassword = (password: string): string => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; };
const passwordMatches = (password: string, stored: string): boolean => { const [salt, hash] = stored.split(':'); return !!salt && !!hash && timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 64)); };
export function createApp(store = new Store(), hints = new HintService()): express.Express {
  const app = express();
  const secret = process.env.JWT_SECRET ?? randomBytes(32).toString('hex');
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new Error('Production requires a JWT_SECRET of at least 32 characters.');
  app.use(helmet(), express.json({ limit: '128kb' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, storage: store.db ? 'postgresql' : 'memory', model: process.env.OLLAMA_MODEL ?? 'gemma3:4b' }));
  app.use('/api/chat', createChatRouter());
  app.post('/api/auth/:action', rateLimit({ windowMs: 60000, limit: 15 }), async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    let user = await store.user(email);
    if (req.params.action === 'register') {
      if (user) { res.status(409).json({ error: 'Email already registered.' }); return; }
      const { name, classCode } = z.object({ name: z.string().trim().min(1).max(60), classCode: z.string().trim().min(2).max(32) }).parse(req.body);
      user = await store.createUser({ email, passwordHash: hashPassword(password), name, classCode, role: 'student' });
    } else if (req.params.action !== 'login' || !user || !passwordMatches(password, user.passwordHash)) { res.status(401).json({ error: 'Invalid email or password.' }); return; }
    res.json({ token: jwt.sign({ sub: user.id }, secret, { expiresIn: '7d', algorithm: 'HS256' }), user: { id: user.id, name: user.name, role: user.role, classCode: user.classCode } });
  });
  app.use('/api', async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      if (!token) { res.status(401).json({ error: 'Sign in to save progress.' }); return; }
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid token');
      const user = await store.userById(payload.sub); if (!user) throw new Error('Account not found');
      res.locals.user = user; next();
    } catch { res.status(401).json({ error: 'Session expired. Please sign in again.' }); }
  });
  app.get('/api/questions/next', async (req, res) => {
    const topic = z.enum(topics).parse(req.query.topic ?? 'ends');
    const userId = String(res.locals.user.id);
    const { mastery, attempts } = await store.progress(userId);
    const level = z.enum(['adaptive', 'easy', 'medium', 'hard']).parse(req.query.difficulty ?? 'adaptive');
    const q = generateQuestion(topic, level === 'adaptive' ? targetDifficulty(mastery[topic] ?? 900) : level === 'easy' ? 2 : level === 'medium' ? 3 : 4, Date.now() % 1000000 + attempts.length);
    await store.saveQuestion(q);
    const { reference, ...publicQuestion } = q;
    res.json({ ...publicQuestion, alphabet: reference.alphabet });
  });
  const bodySchema = z.object({ questionId: z.string().max(100), automaton: automatonSchema });
  app.post('/api/attempts', async (req, res) => {
    const { questionId, automaton } = bodySchema.parse(req.body);
    const question = await store.question(questionId); if (!question) { res.status(404).json({ error: 'Question not found. Load a new question.' }); return; }
    const userId = String(res.locals.user.id);
    const result = checkEquivalence(automaton, question.reference);
    const edits = result.equivalent ? [] : diagnose(automaton, question.reference);
    const misconception = classifyMisconception(edits, automaton, question.reference);
    const progress = await store.progress(userId);
    const hintLevel = await store.hintLevel(userId, questionId);
    const score = result.equivalent ? Math.max(.2, 1 - hintLevel * .15) : 0;
    const rating = updateMastery(progress.mastery[question.topic] ?? 900, question.difficulty, score);
    const alreadySolved = progress.attempts.some(a => a.questionId === questionId && a.correct);
    const attempt = { id: randomUUID(), userId, questionId, automaton: automaton as Automaton, correct: result.equivalent, score, hintLevel, misconception, createdAt: new Date().toISOString(), topic: question.topic };
    await store.saveAttempt(attempt, alreadySolved ? progress.mastery[question.topic] ?? 900 : rating);
    res.json({ result, attempt, rating });
  });
  app.post('/api/hints', async (req, res) => {
    const { questionId, automaton, level } = bodySchema.extend({ level: z.number().int().min(1).max(5) }).parse(req.body);
    const q = await store.question(questionId); if (!q) { res.status(404).json({ error: 'Question not found.' }); return; }
    const userId = String(res.locals.user.id);
    const result = checkEquivalence(automaton, q.reference);
    const edits = result.equivalent ? [] : diagnose(automaton, q.reference);
    const trace = result.equivalent || [...result.counterexample].some(symbol => !automaton.alphabet.includes(symbol)) ? [] : simulate(automaton, result.counterexample).trace;
    const hint = await hints.get({ questionId, question: q.prompt, reference: q.reference, result, edits, misconception: classifyMisconception(edits, automaton, q.reference), level, trace });
    await store.recordHint(userId, questionId, level);
    res.json({ ...hint, ...(level === 5 ? { solution: q.reference } : {}) });
  });
  app.get('/api/progress', async (_req, res) => res.json(await store.progress(String(res.locals.user.id))));
  app.get('/api/instructor', async (_req, res) => {
    if (res.locals.user.role !== 'instructor') { res.status(403).json({ error: 'Instructor access required.' }); return; }
    res.json({ classCode: res.locals.user.classCode, misconceptions: await store.classReport(String(res.locals.user.classCode)) });
  });
  app.post('/api/debug', async (req, res) => {
    const { questionId, witness } = z.object({ questionId: z.string(), witness: z.string().max(128).optional() }).parse(req.body);
    const q = await store.question(questionId); if (!q) { res.status(404).json({ error: 'Question not found.' }); return; }
    const faulty = mutateAutomaton(q.reference, q.seed, 2).automaton;
    if (witness === undefined) { res.json({ automaton: faulty }); return; }
    if ([...witness].some(s => !q.reference.alphabet.includes(s))) { res.status(400).json({ error: 'Use only the question alphabet.' }); return; }
    res.json({ valid: simulate(faulty, witness).accepted !== simulate(q.reference, witness).accepted });
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues.map(i => i.message).join(' ') }); return; }
    console.error(error); res.status(500).json({ error: 'The request could not be completed. Please retry.' });
  });
  return app;
}
