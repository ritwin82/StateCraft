import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
dotenv.config();
const { createApp } = await import('./app.js');
const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, '127.0.0.1', () => console.log(`Tutor API listening on http://127.0.0.1:${port}`));
