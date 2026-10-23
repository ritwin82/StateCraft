import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { createChatRouter } from '../api/src/chat';
export default defineConfig({ plugins: [react(), tailwind(), {
  name: 'local-ollama-chat',
  configureServer(server) { server.middlewares.use('/api/chat', createChatRouter()); },
}], server: { port: 5173, proxy: { '^/api/(?!chat(?:/|$))': 'http://127.0.0.1:3001' } }, build: { chunkSizeWarningLimit: 700 } });
