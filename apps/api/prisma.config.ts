import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); dotenv.config();
export default defineConfig({ schema: 'prisma/schema.prisma' });
