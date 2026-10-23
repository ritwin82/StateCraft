import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); dotenv.config();
import { PrismaClient } from '@prisma/client';
const email = process.argv[2]?.toLowerCase();
if (!email) throw new Error('Usage: pnpm --filter @tutor/api instructor email@example.com');
const db = new PrismaClient();
try {
  const user = await db.user.update({ where: { email }, data: { role: 'instructor' } });
  console.log(`Instructor enabled for ${user.email} in class ${user.classCode}. Sign in again to refresh the interface.`);
} finally { await db.$disconnect(); }
