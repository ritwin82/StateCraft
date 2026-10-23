import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import type { Automaton, Question } from '@tutor/engine';
export type UserRecord = { id: string; email: string; name: string; passwordHash: string; role: string; classCode: string };
export type AttemptRecord = { id: string; userId: string; questionId: string; automaton: Automaton; correct: boolean; score: number; hintLevel: number; misconception: string; createdAt: string; topic: string };
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export class Store {
  readonly db: PrismaClient | null;
  private users = new Map<string, UserRecord>();
  private questions = new Map<string, Question>();
  private attempts = new Map<string, AttemptRecord>();
  private ratings = new Map<string, Record<string, number>>();
  private hints = new Map<string, number>();
  constructor(database = process.env.DATABASE_URL) { this.db = database ? new PrismaClient() : null; }
  async user(email: string): Promise<UserRecord | null> { return this.db ? this.db.user.findUnique({ where: { email } }) : [...this.users.values()].find(u => u.email === email) ?? null; }
  async userById(id: string): Promise<UserRecord | null> { return this.db ? this.db.user.findUnique({ where: { id } }) : this.users.get(id) ?? null; }
  async createUser(data: Omit<UserRecord, 'id'>): Promise<UserRecord> {
    if (this.db) return this.db.user.create({ data });
    if (await this.user(data.email)) throw new Error('Email already registered.');
    const user = { ...data, id: randomUUID() }; this.users.set(user.id, user); return user;
  }
  async saveQuestion(q: Question): Promise<void> {
    this.questions.set(q.id, q);
    if (this.db) await this.db.question.upsert({ where: { id: q.id }, create: { id: q.id, topic: q.topic, difficulty: q.difficulty, data: json(q) }, update: {} });
  }
  async hintLevel(userId: string, questionId: string): Promise<number> {
    if (this.db) return (await this.db.hintUsage.findUnique({ where: { userId_questionId: { userId, questionId } } }))?.level ?? 0;
    return this.hints.get(`${userId}:${questionId}`) ?? 0;
  }
  async recordHint(userId: string, questionId: string, level: number): Promise<void> {
    const maximum = Math.max(level, await this.hintLevel(userId, questionId));
    if (this.db) await this.db.hintUsage.upsert({ where: { userId_questionId: { userId, questionId } }, create: { userId, questionId, level: maximum }, update: { level: maximum } });
    else this.hints.set(`${userId}:${questionId}`, maximum);
  }
  async question(id: string): Promise<Question | null> {
    const cached = this.questions.get(id); if (cached) return cached;
    const row = this.db ? await this.db.question.findUnique({ where: { id } }) : null;
    return row ? row.data as unknown as Question : null;
  }
  async saveAttempt(attempt: AttemptRecord, rating: number): Promise<void> {
    if (this.db) {
      await this.db.$transaction([
        this.db.attempt.create({ data: { id: attempt.id, userId: attempt.userId, questionId: attempt.questionId, automaton: json(attempt.automaton), correct: attempt.correct, score: attempt.score, hintLevel: attempt.hintLevel, misconceptions: { create: attempt.misconception === 'UNKNOWN' ? [] : [{ name: attempt.misconception }] } } }),
        this.db.mastery.upsert({ where: { userId_topic: { userId: attempt.userId, topic: attempt.topic } }, create: { userId: attempt.userId, topic: attempt.topic, rating }, update: { rating } }),
      ]);
    } else {
      this.attempts.set(attempt.id, attempt);
      this.ratings.set(attempt.userId, { ...this.ratings.get(attempt.userId), [attempt.topic]: rating });
    }
  }
  async progress(userId: string): Promise<{ attempts: AttemptRecord[]; mastery: Record<string, number> }> {
    if (!this.db) return { attempts: [...this.attempts.values()].filter(a => a.userId === userId).reverse(), mastery: this.ratings.get(userId) ?? {} };
    const [attempts, mastery] = await Promise.all([
      this.db.attempt.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 200, include: { misconceptions: true, question: true } }),
      this.db.mastery.findMany({ where: { userId } }),
    ]);
    return { attempts: attempts.map(a => ({ ...a, automaton: a.automaton as unknown as Automaton, createdAt: a.createdAt.toISOString(), topic: a.question.topic, misconception: a.misconceptions[0]?.name ?? 'UNKNOWN' })), mastery: Object.fromEntries(mastery.map(m => [m.topic, m.rating])) };
  }
  async classReport(classCode: string): Promise<{ name: string; count: number }[]> {
    const users = this.db ? await this.db.user.findMany({ where: { classCode }, select: { id: true } }) : [...this.users.values()].filter(u => u.classCode === classCode);
    const counts = new Map<string, number>();
    for (const user of users) for (const attempt of (await this.progress(user.id)).attempts) if (attempt.misconception !== 'UNKNOWN') counts.set(attempt.misconception, (counts.get(attempt.misconception) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count }));
  }
}
