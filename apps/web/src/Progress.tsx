import { useEffect, useState } from 'react';
import { topics } from '@tutor/engine';
import { api, useStudio } from './store';
import type { Attempt } from './store';
export const topicLabels: Record<string, string> = { nfa: 'NFA practice', enfa: 'ε-NFA practice', ends: 'Ends with a pattern', starts: 'Starts with a pattern', contains: 'Contains a pattern', count: 'Symbol counting', length: 'String length', union: 'Union of languages', intersection: 'Intersection', complement: 'Complement' };
export function Progress({ instructor = false }: { instructor?: boolean }) {
  const s = useStudio();
  const [data, setData] = useState({ attempts: s.attempts, mastery: s.mastery });
  const [classRows, setClassRows] = useState<{ name: string; count: number }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!s.session) return;
    if (instructor) void api<{ misconceptions: { name: string; count: number }[] }>('/instructor').then(d => setClassRows(d.misconceptions)).catch(e => setError(String(e)));
    else void api<{ attempts: Attempt[]; mastery: Record<string, number> }>('/progress').then(setData).catch(e => setError(String(e)));
  }, [s.session, instructor]);
  const correct = data.attempts.filter(a => a.correct).length;
  const misconceptions = instructor ? classRows : Object.entries(data.attempts.reduce<Record<string, number>>((acc, a) => { if (a.misconception !== 'UNKNOWN') acc[a.misconception] = (acc[a.misconception] ?? 0) + 1; return acc; }, {})).map(([name, count]) => ({ name, count }));
  return <div className="progress-view"><div className="page-heading"><div><h1>{instructor ? 'A clearer picture of your class.' : 'Understanding, one machine at a time.'}</h1><p>{instructor ? `Class ${s.session?.user.classCode ?? 'Not assigned'} · aggregated misconceptions` : s.session ? 'Your saved learning progress.' : 'Your practice history is saved in this browser.'}</p></div></div>{error && <p role="alert" className="error">{error}</p>}
    {!instructor && <div className="progress-summary"><div><strong>{correct}</strong><span>Correct attempts</span></div><div><strong>{data.attempts.length}</strong><span>Total attempts</span></div><div><strong>{data.attempts.reduce((sum, a) => sum + a.hintLevel, 0)}</strong><span>Hint levels used</span></div></div>}
    <div className="progress-columns">{!instructor && <section><h2>Topic mastery</h2><p className="muted">Elo ratings adapt the next challenge to your progress.</p>{topics.map(topic => <div className="mastery-row" key={topic}><div><strong>{topicLabels[topic]}</strong><span>{data.mastery[topic] ? `${data.mastery[topic]} Elo` : 'Not started'}</span></div><div className="mastery-track"><div style={{ width: `${data.mastery[topic] ? Math.min(100, data.mastery[topic] / 20) : 0}%` }}/></div></div>)}</section>}
    <section><h2>Patterns worth revisiting</h2><p className="muted">Structural diagnoses are clues, not judgments.</p>{misconceptions.length ? misconceptions.map(row => <div className="misconception-row" key={row.name}><span>{row.name.toLowerCase().replaceAll('_', ' ')}</span><div style={{ width: `${Math.max(12, row.count / Math.max(...misconceptions.map(r => r.count)) * 100)}%` }}>{row.count}</div></div>) : <div className="empty-state"><h3>A fresh page.</h3><p>{instructor ? 'No diagnosed misconceptions in this class yet.' : 'Submit a few machines and your learning patterns will appear here.'}</p></div>}</section></div>
    {!instructor && <section className="history"><h2>Attempt history</h2>{data.attempts.length ? <div className="table-scroll"><table><thead><tr><th>Topic</th><th>Result</th><th>Score</th><th>Hints</th><th>When</th></tr></thead><tbody>{data.attempts.map(a => <tr key={a.id}><td>{topicLabels[a.topic] ?? a.topic}</td><td><span className={`status-pill ${a.correct ? 'success' : 'neutral'}`}>{a.correct ? 'Correct' : 'Keep exploring'}</span></td><td>{Math.round(a.score * 100)}%</td><td>{a.hintLevel}/5</td><td>{new Date(a.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <p className="muted">Your first attempt starts your story.</p>}</section>}
  </div>;
}
