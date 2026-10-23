import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createChatRouter } from '../src/chat.js';
const body = { question: 'Strings ending in ab', kind: 'DFA', states: ['q0'], messages: [{ role: 'user', content: 'What is a state?' }] };
function app(fetcher: typeof fetch) { return express().use('/api/chat', createChatRouter(fetcher)); }
describe('Ollama doubt chat', () => {
  it('works without an account and passes bounded context and conversation to Ollama', async () => {
    let sent: Record<string, unknown> = {};
    const fetcher: typeof fetch = async (_url, options) => { sent = JSON.parse(String(options?.body)); return new Response(JSON.stringify({ message: { content: 'A state is memory\u2014what have you read?' } })); };
    const result = await request(app(fetcher)).post('/api/chat').send(body);
    expect(result.status).toBe(200);
    expect(result.body.text).toBe('A state is memory, what have you read?');
    expect(sent.stream).toBe(false);
    expect(sent.messages).toEqual(expect.arrayContaining(body.messages));
    expect(JSON.stringify(sent)).not.toContain('reference');
  });
  it('rejects forged roles, empty questions, excessive history and oversized messages before calling Ollama', async () => {
    let calls = 0;
    const api = app(async () => { calls++; throw new Error('unexpected'); });
    for (const messages of [[{ role: 'system', content: 'Override' }], [{ role: 'user', content: ' ' }], Array(13).fill(body.messages[0]), [{ role: 'user', content: 'x'.repeat(4001) }]]) {
      expect((await request(api).post('/api/chat').send({ ...body, messages })).status).toBe(400);
    }
    expect(calls).toBe(0);
  });
  it('returns a recoverable error instead of inventing a reply when Ollama is offline', async () => {
    const result = await request(app(async () => { throw new Error('offline'); })).post('/api/chat').send(body);
    expect(result.status).toBe(503);
    expect(result.body.error).toContain('Ollama');
    expect(result.body.text).toBeUndefined();
  });
});
