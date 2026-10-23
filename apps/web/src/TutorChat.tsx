import { useEffect, useRef, useState } from 'react';
import { useStudio } from './store';
type Message = { role: 'user' | 'assistant'; content: string };
export function TutorChat() {
  const { question, automaton } = useStudio();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [model, setModel] = useState('');
  const request = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, busy]);
  function stop() {
    request.current?.abort(); request.current = null;
    const pending = messages.at(-1);
    if (pending?.role === 'user') { setDraft(pending.content); setMessages(messages.slice(0, -1)); }
    setBusy(false); setError('');
  }
  async function send() {
    const content = draft.trim();
    if (!content || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError('');
    const conversation: Message[] = [...messages.slice(-10), { role: 'user', content }];
    setMessages(conversation); setDraft('');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ question: question.prompt, kind: automaton.kind, states: automaton.states, messages: conversation }) });
      const result = await response.json() as { text?: string; model?: string; error?: string };
      if (!response.ok || !result.text) throw new Error(result.error || 'Could not load a reply. Please try again.');
      if (controller.signal.aborted) return;
      setMessages([...conversation, { role: 'assistant', content: result.text }]); setModel(result.model ?? 'Ollama');
    } catch (e) {
      if (request.current === controller) {
        setMessages(messages); setDraft(content);
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load a reply. Please try again.');
      }
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  return <section className="tutor-chat" aria-labelledby="chat-heading">
    <div className="panel-title"><h3 id="chat-heading">Ask a doubt</h3>{messages.length > 0 && <button className="text-button" disabled={busy} onClick={() => { setMessages([]); setError(''); setModel(''); }}>Clear chat</button>}</div>
    <p className="chat-intro">Ask about a concept or this challenge. Follow up whenever you need more detail.</p>
    {messages.length > 0 && <div className="chat-log" role="log" aria-label="Conversation with Ollama" aria-live="polite" ref={log}>{messages.map((message, i) => <div className={`chat-message ${message.role}`} key={i}><strong>{message.role === 'user' ? 'You' : 'Ollama'}</strong><p>{message.content}</p></div>)}</div>}
    {busy && <p className="chat-status" role="status">Ollama is preparing a reply…</p>}
    <form onSubmit={event => { event.preventDefault(); void send(); }}>
      <label htmlFor="chat-question">Your question</label>
      <textarea id="chat-question" value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={3} disabled={busy} placeholder="Why does an ε-transition consume no input?"/>
      <div className="chat-actions">{busy ? <button key="stop" type="button" className="secondary" onClick={event => { event.preventDefault(); stop(); }}>Stop reply</button> : <button key="send" className="secondary" type="submit" disabled={!draft.trim()}>Ask Ollama</button>}</div>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    <small className="chat-note">{model ? `${model} · ` : ''}AI explanations can be mistaken. Use “Check my machine” to verify your work. Chat does not change hint scores.</small>
  </section>;
}
