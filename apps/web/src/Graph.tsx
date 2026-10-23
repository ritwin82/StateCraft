import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Controls, ControlButton, useReactFlow, useViewport, Handle, Position, BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType } from '@xyflow/react';
import type { Node, NodeProps, EdgeProps, Connection } from '@xyflow/react';
import { useStudio } from './store';
import type { TraceStep } from '@tutor/engine';
type StateData = { label: string; final: boolean; start: boolean; active: boolean; [key: string]: unknown };
type StateNode = Node<StateData, 'state'>;
function AutomatonNode({ data, selected }: NodeProps<StateNode>) {
  const { zoom } = useViewport();
  return <div className={`state-node ${data.final ? 'is-final' : ''} ${data.active ? 'is-active' : ''} ${selected ? 'is-selected' : ''}`}>
    {data.start && <span className="start-arrow"><svg width="32" height="20" viewBox="0 0 32 20" aria-hidden="true"><path d="M0 10H28M20 3L28 10L20 17" fill="none" stroke="currentColor" strokeWidth="2"/></svg><span>start</span></span>}
    <Handle type="target" position={Position.Left}/><span style={{ fontSize: Math.max(20, 14 / zoom) }}>{data.label}</span><Handle type="source" position={Position.Right}/>
    {data.active && <span className="state-token" aria-label="Active state"/>}
    
  </div>;
}
function AutomatonEdge(props: EdgeProps) {
  const { zoom } = useViewport();
  const { id, sourceX, sourceY, targetX, targetY, source, target, markerEnd, label, style } = props;
  const loop = source === target;
  const backwards = sourceX > targetX;
  const [normal, normalX, normalY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition: Position.Right, targetPosition: Position.Left, curvature: .35 });
  const path = loop ? `M ${sourceX - 8} ${sourceY - 22} C ${sourceX + 45} ${sourceY - 105}, ${targetX - 45} ${targetY - 105}, ${targetX + 8} ${targetY - 22}` : backwards ? `M ${sourceX} ${sourceY} C ${sourceX + 50} ${sourceY + 125}, ${targetX - 50} ${targetY + 125}, ${targetX} ${targetY}` : normal;
  const x = loop ? (sourceX + targetX) / 2 : backwards ? (sourceX + targetX) / 2 : normalX;
  const y = loop ? sourceY - 81 : backwards ? sourceY + 94 : normalY;
  return <><BaseEdge id={id} path={path} {...(markerEnd ? { markerEnd } : {})} style={style}/><EdgeLabelRenderer><button type="button" className={`edge-label nodrag nopan ${props.selected ? 'edge-label-selected' : ''}`} aria-label={`Edit transitions from ${source} to ${target}: ${String(label)}`} aria-pressed={!!props.selected} onClick={event => { event.stopPropagation(); if (typeof props.data?.onSelect === 'function') props.data.onSelect(); }} style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px) scale(${1 / zoom})`, pointerEvents: 'all' }}><span>{String(label)}</span></button></EdgeLabelRenderer></>;
}
function GraphControls() {
  const flow = useReactFlow();
  return <Controls showZoom={false} showFitView={false} showInteractive={false}>
    <ControlButton aria-label="Zoom in" onClick={() => void flow.zoomIn()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10H17M10 3V17" stroke="currentColor" strokeWidth="2"/></svg></ControlButton>
    <ControlButton aria-label="Zoom out" onClick={() => void flow.zoomOut()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10H17" stroke="currentColor" strokeWidth="2"/></svg></ControlButton>
    <ControlButton aria-label="Fit machine to canvas" onClick={() => void flow.fitView({ padding: .4, maxZoom: 1.2 })}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3V7M13 3H17V7M3 13V17H7M13 17H17V13" fill="none" stroke="currentColor" strokeWidth="2"/></svg></ControlButton>
  </Controls>;
}
const nodeTypes = { state: AutomatonNode };
const edgeTypes = { automaton: AutomatonEdge };
export function Graph({ trace, previous, onConnect }: { trace: TraceStep | undefined; previous: TraceStep | undefined; onConnect: (connection: Connection) => void }) {
  const { automaton, positions, selected, setPosition, select, setGraph, locked, question } = useStudio();
  const [selectedEdge, setSelectedEdge] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => { setSelectedEdge(null); }, [question.id]);
  useEffect(() => { if (selected !== null) setSelectedEdge(null); }, [selected]);
  const selectedTransitions = selectedEdge ? automaton.transitions.filter(t => t.from === selectedEdge.from && t.to === selectedEdge.to) : [];
  const nodes: StateNode[] = useMemo(() => automaton.states.map(id => ({ id, type: 'state', position: positions[id] ?? { x: 100, y: 100 }, selected: id === selected, data: { label: id, final: automaton.finals.includes(id), start: id === automaton.start, active: trace?.activeStates.includes(id) ?? false } })), [automaton, positions, selected, trace]);
  const edges = useMemo(() => {
    const groups = new Map<string, { from: string; to: string; symbols: string[] }>();
    for (const t of automaton.transitions) { const key = JSON.stringify([t.from, t.to]); const item = groups.get(key) ?? { from: t.from, to: t.to, symbols: [] }; item.symbols.push(t.symbol); groups.set(key, item); }
    return [...groups].map(([id, item]) => {
      const active = !!trace && !!previous && previous.activeStates.includes(item.from) && trace.activeStates.includes(item.to) && item.symbols.includes(trace.symbol ?? '');
      const isSelected = selectedEdge?.from === item.from && selectedEdge.to === item.to;
      return { id, source: item.from, target: item.to, type: 'automaton', label: item.symbols.join(', '), selected: isSelected, data: { onSelect: () => { select(null); setSelectedEdge({ from: item.from, to: item.to }); } }, markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: active || isSelected ? 'var(--accent)' : 'var(--muted)' }, style: { stroke: active || isSelected ? 'var(--accent)' : 'var(--muted)', strokeWidth: active || isSelected ? 3 : 1.7 } };
    });
  }, [automaton, trace, previous, selectedEdge, select]);
  return <><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onConnect={onConnect} onEdgeClick={(_event, edge) => { select(null); setSelectedEdge({ from: edge.source, to: edge.target }); }} onNodeClick={(_e, node) => { setSelectedEdge(null); select(node.id); }} onPaneClick={() => { select(null); setSelectedEdge(null); }} onNodesChange={changes => { for (const change of changes) if (change.type === 'position' && change.position) setPosition(change.id, change.position); else if (change.type === 'select' && change.selected) select(change.id); }} fitView fitViewOptions={{ padding: .4, maxZoom: 1.2 }} minZoom={.25} maxZoom={2} deleteKeyCode={null} proOptions={{ hideAttribution: false }} aria-label="Automaton graph editor">
    <GraphControls/>
  </ReactFlow>{selectedEdge && selectedTransitions.length > 0 && <section className="transition-inspector" aria-label="Selected transitions">
    <div className="panel-title"><strong>{selectedEdge.from} → {selectedEdge.to}</strong><button className="icon-button" aria-label="Close transition inspector" onClick={() => setSelectedEdge(null)}><span>Close</span></button></div>
    <p>Delete a transition. Both states stay in place.</p>
    {selectedTransitions.map(t => <div className="transition-delete-row" key={t.symbol}><span>On <b>{t.symbol}</b></span><button disabled={locked} aria-label={`Delete transition ${t.from} ${t.symbol} ${t.to}`} onClick={() => { setGraph({ ...automaton, transitions: automaton.transitions.filter(candidate => !(candidate.from === t.from && candidate.symbol === t.symbol && candidate.to === t.to)) }); if (selectedTransitions.length === 1) setSelectedEdge(null); }}>Delete transition</button></div>)}
  </section>}</>;
}
