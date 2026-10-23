import { useState } from 'react';
import { simulate } from '@tutor/engine';
import { useStudio, api } from './store';
import { verify } from './verify';
import { TutorChat } from './TutorChat';
import type { Automaton, Edit } from '@tutor/engine';
function editText(e: Edit): string {
  if (e.type === 'toggleFinal') return `Toggle acceptance of ${e.state}.`;
  if (e.type === 'addState') return `Add ${e.state}.`;
  if (e.type === 'changeTarget') return `${e.from}, ${e.symbol}: change ${e.oldTo} to ${e.newTo}.`;
  return `${e.type === 'addTransition' ? 'Add' : 'Remove'} ${e.from}, ${e.symbol} → ${e.to}.`;
}
export function TutorPanel({ onCounterexample }: { onCounterexample: (word: string) => void }) {
  const s = useStudio();
  const [busy, setBusy] = useState(false), [hint, setHint] = useState(''), [error, setError] = useState(''), [source, setSource] = useState(''), [witness, setWitness] = useState('');
  async function getHint() {
    setBusy(true); setError('');
    const level = Math.min(5, s.hintLevel + 1);
    try {
      if (s.session && s.remoteQuestionId) {
        const result = await api<{ text: string; source: string }>('/hints', { questionId: s.remoteQuestionId, automaton: s.automaton, level });
        if (useStudio.getState().question.id !== s.question.id) return;
        setHint(result.text); setSource(result.source === 'ollama' ? 'Phrased by local Ollama' : 'Verified template');
      } else {
        const v = await verify(s.automaton, s.question.reference);
        if (useStudio.getState().question.id !== s.question.id) return;
        const text = v.result.equivalent ? 'Your machine is correct. What does each state remember about the input so far?' : level === 1 ? 'What information must your states remember? Start with the shortest strings that meet the condition, and ones that almost do.' : level === 2 ? `Try “${v.result.counterexample || 'ε'}”. The language should ${v.result.shouldAccept ? 'accept' : 'reject'} it. Follow the trace carefully.` : level === 3 ? `Inspect ${[...new Set(v.edits?.map(e => 'from' in e ? e.from : e.state) ?? [])].join(', ') || 'the states along the counterexample'}. What does reaching each state mean?` : level === 4 ? v.edits?.map(editText).join('\n') || 'No repair was established within the search budget. Try the worked solution.' : `Start: ${s.question.reference.start}. Accepting: ${s.question.reference.finals.join(', ') || 'none'}.\n${s.question.reference.transitions.map(t => `${t.from}, ${t.symbol} → ${t.to}`).join('\n')}`;
        setHint(text); setSource('Verified template · sign in for Ollama hints');
      }
      useStudio.setState({ hintLevel: level });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load a hint.'); } finally { setBusy(false); }
  }
  return <aside className="tutor-panel"><div className="panel-title"><h2>Your learning space</h2></div>
    <div className="task-details"><h3>A little structure helps.</h3><p>Give each state a meaning. Then ask what changes when the next symbol arrives.</p><div className="legend"><span><i className="legend-start"/>Start state</span><span><i className="legend-final"/>Accepting state</span></div></div>
    {s.mode === 'debug' && <section className="debug-witness"><h3>First, find the bug</h3><p>Submit a string that the original faulty machine handles incorrectly. Empty input means ε.</p><form onSubmit={e => { e.preventDefault(); try { const faulty: Automaton = s.faulty ?? s.automaton; const valid = simulate(faulty, witness).accepted !== simulate(s.question.reference, witness).accepted; useStudio.setState({ witnessVerified: valid }); setError(valid ? '' : 'That string does not expose the bug. Try another.'); } catch { setError('Use only symbols from the alphabet.'); } }}><input aria-label="Failing string" value={witness} onChange={e => setWitness(e.target.value)}/><button className="secondary">Verify witness</button></form>{s.witnessVerified && <p className="success-text">Witness verified. Now repair the machine.</p>}</section>}
    {s.result && <section className={`result-box ${s.result.equivalent ? 'correct' : 'incorrect'}`} aria-live="polite">{s.result.equivalent ? <><h3>Beautifully done.</h3><p>Your machine accepts exactly the required language, for every possible string.</p><button className="text-button" onClick={() => { void s.newQuestion().catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load a challenge.")); }}>Next challenge </button></> : <><h3>Almost. Follow this string.</h3><p>Your machine should {s.result.shouldAccept ? 'accept' : 'reject'} <strong>{s.result.counterexample || 'ε (empty string)'}</strong>.</p><button className="text-button" onClick={() => { if (s.result && !s.result.equivalent) onCounterexample(s.result.counterexample); }}>Trace counterexample </button></>}</section>}
    <section className="hint-section"><div className="panel-title"><h3>A nudge, when you need it</h3></div><p>Start with an idea. Reveal a little more only when you’re ready.</p><div className="hint-levels" aria-label={`Hint level ${s.hintLevel} of 5`}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= s.hintLevel ? 'filled' : ''}>{n}</span>)}</div><button className="hint-button" disabled={busy || s.hintLevel >= 5} onClick={() => void getHint()}>{busy ? 'Preparing your hint…' : s.hintLevel === 5 ? 'All hints revealed' : s.hintLevel ? 'Reveal the next hint' : 'Give me a hint'}</button>
      {hint && <div className="hint-copy" aria-live="polite"><p>{hint}</p><span>{source}</span></div>}<small>Hints reduce the attempt score. Learning still comes first.</small>
    </section>{error && <p className="error" role="alert">{error}</p>}
    <TutorChat/>
    <div className="verification-note"><p><strong>Grounded in formal verification.</strong><br/>An automata engine checks your work. AI only helps explain it.</p></div>
  </aside>;
}
