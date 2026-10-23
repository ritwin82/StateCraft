import { useState } from 'react';
import { Plus, Trash2, Check, Flag, X } from 'lucide-react';
import { useStudio } from './store';
export function StateInspector() {
  const { automaton: a, selected, setGraph, select } = useStudio();
  if (!selected) return null;
  return <div className="state-inspector"><strong>{selected}</strong>
    <button onClick={() => setGraph({ ...a, start: selected })} className={a.start === selected ? 'active' : ''}><Flag size={14}/>Start</button>
    <button onClick={() => setGraph({ ...a, finals: a.finals.includes(selected) ? a.finals.filter(s => s !== selected) : [...a.finals, selected] })} className={a.finals.includes(selected) ? 'active' : ''}><Check size={15}/>Accepting</button>
    <button aria-label={`Delete ${selected}`} disabled={a.states.length < 2} onClick={() => { const states = a.states.filter(s => s !== selected); setGraph({ ...a, states, start: a.start === selected ? states[0] ?? '' : a.start, finals: a.finals.filter(s => s !== selected), transitions: a.transitions.filter(t => t.from !== selected && t.to !== selected) }); select(null); }}><Trash2 size={15}/></button>
    <button aria-label="Close state inspector" onClick={() => select(null)}><X size={14}/></button>
  </div>;
}
export function TransitionEditor({ initial, onClose }: { initial: { from: string; to: string }; onClose: () => void }) {
  const { automaton: a, setGraph } = useStudio();
  const [from, setFrom] = useState(initial.from), [to, setTo] = useState(initial.to), [label, setLabel] = useState('a'), [error, setError] = useState('');
  return <form className="transition-editor" onSubmit={event => {
    event.preventDefault(); const symbols = [...new Set(label.split(',').map(s => s.trim()))];
    if (symbols.some(s => !a.alphabet.includes(s) && !(a.kind === 'ENFA' && s === 'ε'))) { setError(`Use ${a.alphabet.join(', ')}${a.kind === 'ENFA' ? ' or ε' : ''}. Separate symbols with commas.`); return; }
    if (!a.states.includes(from) || !a.states.includes(to)) { setError('Select existing states.'); return; }
    const transitions = a.kind === 'DFA' ? a.transitions.filter(t => !(t.from === from && symbols.includes(t.symbol))) : a.transitions;
    setGraph({ ...a, transitions: [...transitions, ...symbols.filter(symbol => !transitions.some(t => t.from === from && t.to === to && t.symbol === symbol)).map(symbol => ({ from, symbol, to }))] }); onClose();
  }}>
    <div className="panel-title"><strong>Add a transition</strong><button type="button" className="icon-button" aria-label="Close transition editor" onClick={onClose}><X size={17}/></button></div>
    <div className="transition-inputs"><label>From<select aria-label="From state" value={from} onChange={e => setFrom(e.target.value)}>{a.states.map(s => <option key={s}>{s}</option>)}</select></label><label>Symbol<input aria-label="Transition symbol" value={label} onChange={e => setLabel(e.target.value)}/></label><label>To<select aria-label="To state" value={to} onChange={e => setTo(e.target.value)}>{a.states.map(s => <option key={s}>{s}</option>)}</select></label></div>
    {error && <p className="error" role="alert">{error}</p>}<p className="small muted">Use a,b for both symbols. A DFA transition replaces its existing target.</p><button className="primary" type="submit"><Plus size={15}/>Save transition</button>
  </form>;
}
export function TransitionTable() {
  const { automaton: a, setGraph, select } = useStudio();
  return <details className="transition-table"><summary>Transition table <span>{a.transitions.length} transitions</span></summary>
    <div className="state-buttons">{a.states.map(state => <button key={state} onClick={() => select(state)}>{state}{a.finals.includes(state) ? ' (accepting)' : ''}</button>)}</div>
    <div className="table-scroll"><table><thead><tr><th>From</th><th>Symbol</th><th>To</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{a.transitions.map((t, i) => <tr key={JSON.stringify(t)}><td>{t.from}</td><td>{t.symbol}</td><td>{t.to}</td><td><button className="icon-button" aria-label={`Remove ${t.from} ${t.symbol} ${t.to}`} onClick={() => setGraph({ ...a, transitions: a.transitions.filter((_, index) => index !== i) })}><Trash2 size={13}/></button></td></tr>)}</tbody></table></div>
  </details>;
}
