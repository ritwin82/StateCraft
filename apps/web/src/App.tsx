import { useEffect, useRef, useState } from 'react';
import { GitBranch, LayoutDashboard, Bug, ChartNoAxesCombined, BookOpen, ArrowUpRight, UserRound, CircleHelp, GraduationCap } from 'lucide-react';
import { Workspace } from './Workspace';
import { Progress } from './Progress';
import { Account } from './Account';
import { useStudio } from './store';
type View = 'studio' | 'debug' | 'progress' | 'guide' | 'account' | 'instructor';
export default function App() {
  const [view, setView] = useState<View>('studio');
  const [navigationError, setNavigationError] = useState('');
  const { session, newQuestion } = useStudio();
  const navigationVersion = useRef(0);
  const initializedAccount = useRef<string | null>(null);
  useEffect(() => {
    if (!session) { initializedAccount.current = null; return; }
    if (initializedAccount.current === session.user.id) return;
    initializedAccount.current = session.user.id;
    if (!useStudio.getState().remoteQuestionId) void newQuestion().catch((e: unknown) => setNavigationError(e instanceof Error ? e.message : 'Could not load your account challenge.'));
  }, [session, newQuestion]);
  function navigate(next: View) {
    const version = ++navigationVersion.current;
    setNavigationError('');
    const target = next === 'debug' ? 'debug' : 'practice';
    const current = useStudio.getState();
    if ((next === 'studio' || next === 'debug') && (current.mode !== target || (session && !current.remoteQuestionId))) {
      void newQuestion(undefined, target).then(() => { if (version === navigationVersion.current) setView(next); }).catch((e: unknown) => { if (version === navigationVersion.current) setNavigationError(e instanceof Error ? e.message : 'Could not load the challenge.'); });
    } else setView(next);
  }
  const nav = [{ id: 'studio', label: 'Practice studio', icon: LayoutDashboard }, { id: 'debug', label: 'Debug the machine', icon: Bug }, { id: 'progress', label: 'My progress', icon: ChartNoAxesCombined }, { id: 'guide', label: 'Field guide', icon: BookOpen }] as const;
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => navigate('studio')}><span className="brand-mark"><GitBranch size={24}/></span><span>statecraft<span className="brand-period">.</span><small>MAKE THE ABSTRACT CLICK</small></span></button><div className="sidebar-section">Your workspace</div><nav aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'nav-active' : ''} onClick={() => navigate(id)}><Icon size={19}/><span>{label}</span>{view === id && <span className="nav-dot"/>}</button>)}{session?.user.role === 'instructor' && <button className={view === 'instructor' ? 'nav-active' : ''} onClick={() => navigate('instructor')}><GraduationCap size={19}/><span>My class</span></button>}</nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="mini-machine"><i/><i/><i/></span><h3>It starts with a state.</h3><p>A little curiosity.<br/>A few transitions.<br/>A clearer understanding.</p><button onClick={() => navigate('guide')}>Find your footing <ArrowUpRight size={15}/></button></div><button className="profile" onClick={() => navigate('account')}><span className="avatar">{session?.user.name.slice(0, 1).toUpperCase() ?? <UserRound size={18}/>}</span><span>{session?.user.name ?? 'Your own pace'}<small>{session ? 'Connected account' : 'Local practice'}</small></span><ArrowUpRight size={15}/></button></div></aside>
    <div className="main-shell"><header className="topbar"><div><span>Workspace</span><span className="breadcrumb">/</span><strong>{view === 'studio' ? 'Practice studio' : view === 'debug' ? 'Debug the machine' : view === 'progress' ? 'My progress' : view === 'guide' ? 'Field guide' : view === 'instructor' ? 'My class' : 'Account'}</strong></div><div className="topbar-right"><span className="local-badge"><span className="tiny-dot"/>{session ? 'Connected learning' : 'Local practice'}</span><button className="icon-button" aria-label="Open field guide" onClick={() => navigate('guide')}><CircleHelp size={19}/></button><button className="top-avatar" aria-label="Open account" onClick={() => navigate('account')}>{session?.user.name.slice(0, 1).toUpperCase() ?? 'S'}</button></div></header><main>{navigationError && <p className="error" role="alert">{navigationError}</p>}{view === 'studio' || view === 'debug' ? <Workspace/> : view === 'progress' ? <Progress/> : view === 'instructor' ? <Progress instructor/> : view === 'account' ? <Account/> : <Guide/>}</main><footer className="app-footer"><span>Made for the moment it clicks.</span><span>Deterministic by design. Curious by nature.</span></footer></div></div>;
}
function Guide() {
  return <article className="guide"><h1>Make the abstract click.</h1><p className="guide-lead">An automaton is a small machine with a very specific memory. Every state tells you something about the string you’ve read so far.</p><section><h2>Build with meaning</h2><p>Add a state for each piece of information your machine must remember. Select a state to mark it as the start or as accepting. Connect the right handle of one state to the left handle of another, or use the Transition button.</p><p>In a DFA, each state has at most one target per symbol. Missing transitions reject. In an NFA, a symbol may lead to several states. An ε-NFA can also move without consuming a symbol.</p></section><section><h2>Follow the string</h2><p>Enter a string, run it, and press play or step forward. Active states light up. NFA branches show multiple active tokens. An empty input is the empty string ε. Accept if any final active state is accepting.</p></section><section><h2>Use a counterexample</h2><p>Check your machine to compare its language with the reference. If they differ, the engine gives the shortest failing string, choosing the lexicographically first one when tied. Trace it and ask where the state’s meaning stopped matching the input.</p></section><section><h2>Learn with hints</h2><ol><li>A conceptual nudge.</li><li>A counterexample to trace.</li><li>A state to inspect.</li><li>A verified repair, when one is found.</li><li>A full worked solution.</li></ol><p>Hints reduce the score by 15 percentage points per level, with a minimum correct score of 20%. Local practice uses templates. Signed-in challenges can use your local Ollama model; verified templates take over when it is unavailable.</p></section><section><h2>Work your way</h2><p>Use the transition table for keyboard editing. Export and import machine JSON to keep your work. Convert to DFA animates subset construction. Debug mode asks you to prove a machine is wrong with a failing string before you repair it.</p><p>Question references run in the browser to enable instant, local verification. This is a learning tool, not a secure examination environment.</p></section></article>;
}
