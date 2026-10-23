import { useEffect, useRef, useState } from 'react';
import { simulate, subsetConstruction, validateAutomaton, topics } from '@tutor/engine';
import type { Automaton, SimulationResult, SubsetResult, Topic } from '@tutor/engine';
import type { Connection } from '@xyflow/react';
import { Graph } from './Graph';
import { StateInspector, TransitionEditor, TransitionTable } from './EditorTools';
import { Simulator } from './Simulator';
import { TutorPanel } from './TutorPanel';
import { useStudio, layout, api } from './store';
import { verify } from './verify';
import { topicLabels } from './Progress';
export function Workspace() {
  const s = useStudio();
  const [input, setInput] = useState('aab'), [simulation, setSimulation] = useState<SimulationResult | null>(null), [step, setStep] = useState(0), [playing, setPlaying] = useState(false);
  const [error, setError] = useState(''), [simError, setSimError] = useState(''), [busy, setBusy] = useState(false), [transition, setTransition] = useState<{ from: string; to: string } | null>(null);
  const [construction, setConstruction] = useState<SubsetResult | null>(null), [constructionStep, setConstructionStep] = useState(0);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => { useStudio.setState({ locked: !!construction }); return () => { useStudio.setState({ locked: false }); }; }, [construction]);
  useEffect(() => { setConstruction(null); setTransition(null); }, [s.question.id]);
  useEffect(() => { setSimulation(null); setStep(0); setPlaying(false); setSimError(''); }, [s.automaton]);
  useEffect(() => {
    if (!playing || !simulation) return;
    if (step >= simulation.trace.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(() => setStep(step + 1), 700); return () => clearTimeout(timer);
  }, [playing, step, simulation]);
  useEffect(() => {
    if (!construction) return;
    const timer = setTimeout(() => {
      if (constructionStep >= construction.steps.length) { setConstruction(null); return; }
      const count = constructionStep + 1;
      const steps = construction.steps.slice(0, count);
      const states = [...new Set([construction.automaton.start, ...steps.flatMap(t => [t.from, t.to])])];
      s.setGraph({ ...construction.automaton, states, finals: construction.automaton.finals.filter(f => states.includes(f)), transitions: steps.map(({ from, symbol, to }) => ({ from, symbol, to })) }, false);
      setConstructionStep(count);
    }, 450); return () => clearTimeout(timer);
  }, [construction, constructionStep, s.setGraph]);
  function run(word = input) { try { const result = simulate(s.automaton, word); setSimulation(result); setStep(0); setPlaying(false); setSimError(''); } catch (e) { setSimError(e instanceof Error ? e.message : 'Invalid string.'); } }
  async function submit() {
    setBusy(true); setError('');
    try {
      if (s.mode === 'debug' && !s.witnessVerified) throw new Error('Verify a failing string in the learning panel before submitting your repair.');
      const v = await verify(s.automaton, s.question.reference);
      if (useStudio.getState().automaton !== s.automaton || useStudio.getState().question.id !== s.question.id) throw new Error('Your machine changed during verification. Check it again.');
      if (s.session && s.remoteQuestionId) await api('/attempts', { questionId: s.remoteQuestionId, automaton: s.automaton });
      if (useStudio.getState().automaton !== s.automaton || useStudio.getState().question.id !== s.question.id) throw new Error('Your machine changed during verification. Check it again.');
      s.recordAttempt(v.result, v.misconception);
    } catch (e) { setError(e instanceof Error ? e.message : 'Verification failed.'); } finally { setBusy(false); }
  }
  async function nextQuestion(topic: Topic, difficulty = s.difficultyChoice) {
    setError(''); setConstruction(null); setTransition(null);
    setBusy(true);
    try { await s.newQuestion(topic, s.mode, difficulty); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load a challenge.'); }
    finally { setBusy(false); }
  }
  function addState() {
    let i = 0; while (s.automaton.states.includes(`q${i}`)) i++;
    const state = `q${i}`; s.setGraph({ ...s.automaton, states: [...s.automaton.states, state] }); s.select(state);
  }
  function connect(c: Connection) { if (c.source && c.target) setTransition({ from: c.source, to: c.target }); }
  const errors = validateAutomaton(s.automaton);
  return <><section className="challenge-header"><div className="challenge-intro"><div className="challenge-title-line"><h1>{s.mode === 'debug' ? 'Debug the machine.' : 'Small states. Big understanding.'}</h1><span className="difficulty">{s.question.difficulty <= 2 ? 'Easy' : s.question.difficulty <= 3 ? 'Medium' : 'Hard'}</span></div><p>{s.question.prompt}</p><div className="challenge-meta"><span>Alphabet <b>Σ = {'{'}{s.automaton.alphabet.join(', ')}{'}'}</b></span><span>Empty string <b>ε</b></span><span>{s.mode === 'debug' ? 'Find a witness, then repair' : 'Build · test · understand'}</span></div></div><div className="challenge-actions"><label className="sr-only" htmlFor="topic">Practice topic</label><select id="topic" disabled={busy || !!construction} value={s.question.topic} onChange={e => void nextQuestion(e.target.value as Topic)}>{topics.map(t => <option value={t} key={t}>{topicLabels[t]}</option>)}</select><label className="sr-only" htmlFor="difficulty-choice">Question difficulty</label><select id="difficulty-choice" value={s.difficultyChoice} disabled={busy || !!construction} onChange={e => void nextQuestion(s.question.topic, e.target.value as typeof s.difficultyChoice)}><option value="adaptive">Adaptive difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><button className="text-button" disabled={busy} onClick={() => void nextQuestion(s.question.topic)}>Next challenge </button></div></section>
    <div className="workspace-grid"><div className="workspace-main"><section className="canvas-panel"><div className="canvas-toolbar" inert={!!construction}><div className="machine-type"><label className="sr-only" htmlFor="machine-kind">Machine type</label><select id="machine-kind" value={s.automaton.kind} onChange={e => { s.setGraph({ ...s.automaton, kind: e.target.value as Automaton['kind'] }); }}><option>DFA</option><option>NFA</option><option value="ENFA">ε-NFA</option></select></div><div className="toolbar-divider"/><button onClick={addState} disabled={s.automaton.states.length >= (s.automaton.kind === 'DFA' ? 16 : 8) || !!construction}>Add state</button><button onClick={() => setTransition({ from: s.automaton.start, to: s.automaton.start })} disabled={!!construction}>Transition</button><div className="toolbar-spacer"/><button className="icon-button" aria-label="Undo edit" disabled={!s.undo.length || !!construction} onClick={s.undoEdit}><span>Undo</span></button><button className="icon-button" aria-label="Import machine JSON" onClick={() => upload.current?.click()}><span>Import</span></button><button className="icon-button" aria-label="Export machine JSON" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(s.automaton, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'statecraft-machine.json'; a.click(); URL.revokeObjectURL(url); }}><span>Export</span></button>
      <input type="file" accept=".json" ref={upload} hidden onChange={async e => { try { const file = e.target.files?.[0]; if (!file) return; if (file.size > 100000) throw new Error('Machine file must be smaller than 100 KB.'); const parsed: unknown = JSON.parse(await file.text()); if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid automaton JSON.'); const a = parsed as Automaton; const issues = validateAutomaton(a); if (issues.length) throw new Error(issues.map(i => i.message).join(' ')); if (a.states.length > 16) throw new Error('Use at most 16 states.'); s.setGraph(a); useStudio.setState({ positions: layout(a) }); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Invalid automaton JSON.'); } }}/>
      </div><div className="graph-area"><div className="canvas-caption"><span className="live-dot"/>Your machine <span>{s.automaton.states.length} states · {s.automaton.transitions.length} transitions</span></div><div className="graph-content" inert={!!construction}><Graph trace={simulation?.trace[step]} previous={step ? simulation?.trace[step - 1] : undefined} onConnect={connect}/><StateInspector/></div>{transition && <TransitionEditor key={`${transition.from}-${transition.to}`} initial={transition} onClose={() => setTransition(null)}/>}
      {construction && <div className="construction-status">Constructing DFA · {constructionStep}/{construction.steps.length} transitions<br/><small>{construction.steps[Math.max(0, constructionStep - 1)]?.members.join(', ') || '∅'}</small></div>}
      <div className="canvas-help">Select a state or transition to edit</div></div><div className="canvas-footer"><span><span className={`tiny-dot ${errors.length ? 'warning' : ''}`}/>{errors.length ? `${errors.length} validation issue${errors.length === 1 ? '' : 's'}` : 'Ready to explore'}</span><button className="text-button" disabled={!!construction || !!errors.length} onClick={() => { try { const result = subsetConstruction(s.automaton); s.setGraph({ ...result.automaton, states: [result.automaton.start], finals: result.automaton.finals.filter(f => f === result.automaton.start), transitions: [] }); useStudio.setState({ positions: layout(result.automaton) }); setConstructionStep(0); setConstruction(result); } catch (e) { setError(String(e)); } }}>Convert to DFA</button><button className="text-button" aria-label="Clear machine" disabled={!!construction} onClick={() => { setConstruction(null); s.setGraph({ kind: s.automaton.kind, states: ['q0'], start: 'q0', alphabet: [...s.automaton.alphabet], finals: [], transitions: [] }); }}>Clear</button></div></section>
      <Simulator input={input} setInput={word => { setInput(word); setSimulation(null); setStep(0); setPlaying(false); }} simulation={simulation} step={step} setStep={setStep} playing={playing} setPlaying={setPlaying} run={() => run()} error={simError}/>
      <div className="submit-row"><div><span>Checked against every possible string.</span></div><button className="primary submit-button" disabled={busy || !!errors.length || !!construction} onClick={() => void submit()}>{busy ? 'Checking your machine…' : s.mode === 'debug' ? 'Check my repair' : 'Check my machine'}</button></div>{error && <p className="error" role="alert">{error}</p>}{errors.length > 0 && <p className="error" role="alert">{errors.map(e => e.message).join(' ')}</p>}
      <fieldset disabled={!!construction} className="table-fieldset"><TransitionTable/></fieldset>
    </div><TutorPanel key={s.question.id} onCounterexample={word => { setInput(word); run(word); setPlaying(true); }}/></div></>;
}
