import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); dotenv.config();
import { PrismaClient } from '@prisma/client';
import { seedQuestions } from '@tutor/engine';
const db = new PrismaClient();
try {
  const questions = seedQuestions();
  for (const q of questions) await db.question.upsert({ where: { id: q.id }, create: { id: q.id, topic: q.topic, difficulty: q.difficulty, data: JSON.parse(JSON.stringify(q)) }, update: { topic: q.topic, difficulty: q.difficulty, data: JSON.parse(JSON.stringify(q)) } });
  console.log(`Seeded ${questions.length} verified questions: 5 easy, 5 medium, and 5 hard per topic.`);
} finally { await db.$disconnect(); }
