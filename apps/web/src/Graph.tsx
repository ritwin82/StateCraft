import { useMemo } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType, BackgroundVariant } from '@xyflow/react';
import type { Node, NodeProps, EdgeProps, Connection } from '@xyflow/react';
import { ArrowRight, Check } from 'lucide-react';
import { useStudio } from './store';
import type { TraceStep } from '@tutor/engine';
type StateData = { label: string; final: boolean; start: boolean; active: boolean; [key: string]: unknown };
type StateNode = Node<StateData, 'state'>;
function AutomatonNode({ data, selected }: NodeProps<StateNode>) {
  return <div className={`state-node ${data.final ? 'is-final' : ''} ${data.active ? 'is-active' : ''} ${selected ? 'is-selected' : ''}`}>
    {data.start && <span className="start-arrow"><ArrowRight size={28}/><span>start</span></span>}
    <Handle type="target" position={Position.Left}/><span>{data.label}</span><Handle type="source" position={Position.Right}/>
    {data.active && <span className="state-token" aria-label="Active state"/>}
    {data.final && <Check size={11} className="final-check"/>}
  </div>;
}
function AutomatonEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, source, target, markerEnd, label, style } = props;
  const loop = source === target;
  const backwards = sourceX > targetX;
  const [normal, normalX, normalY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition: Position.Right, targetPosition: Position.Left, curvature: .35 });
  const path = loop ? `M ${sourceX - 8} ${sourceY - 22} C ${sourceX + 45} ${sourceY - 105}, ${targetX - 45} ${targetY - 105}, ${targetX + 8} ${targetY - 22}` : backwards ? `M ${sourceX} ${sourceY} C ${sourceX + 50} ${sourceY + 125}, ${targetX - 50} ${targetY + 125}, ${targetX} ${targetY}` : normal;
  const x = loop ? (sourceX + targetX) / 2 : backwards ? (sourceX + targetX) / 2 : normalX;
  const y = loop ? sourceY - 81 : backwards ? sourceY + 94 : normalY;
  return <><BaseEdge id={id} path={path} {...(markerEnd ? { markerEnd } : {})} style={style}/><EdgeLabelRenderer><span className="edge-label" style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)` }}>{String(label)}</span></EdgeLabelRenderer></>;
}
const nodeTypes = { state: AutomatonNode };
const edgeTypes = { automaton: AutomatonEdge };
export function Graph({ trace, previous, onConnect }: { trace: TraceStep | undefined; previous: TraceStep | undefined; onConnect: (connection: Connection) => void }) {
  const { automaton, positions, selected, setPosition, select } = useStudio();
  const nodes: StateNode[] = useMemo(() => automaton.states.map(id => ({ id, type: 'state', position: positions[id] ?? { x: 100, y: 100 }, selected: id === selected, data: { label: id, final: automaton.finals.includes(id), start: id === automaton.start, active: trace?.activeStates.includes(id) ?? false } })), [automaton, positions, selected, trace]);
  const edges = useMemo(() => {
    const groups = new Map<string, { from: string; to: string; symbols: string[] }>();
    for (const t of automaton.transitions) { const key = JSON.stringify([t.from, t.to]); const item = groups.get(key) ?? { from: t.from, to: t.to, symbols: [] }; item.symbols.push(t.symbol); groups.set(key, item); }
    return [...groups].map(([id, item]) => {
      const active = !!trace && !!previous && previous.activeStates.includes(item.from) && trace.activeStates.includes(item.to) && item.symbols.includes(trace.symbol ?? '');
      return { id, source: item.from, target: item.to, type: 'automaton', label: item.symbols.join(', '), animated: active, markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: active ? '#c47632' : '#82998e' }, style: { stroke: active ? '#c47632' : '#82998e', strokeWidth: active ? 3 : 1.7 } };
    });
  }, [automaton, trace, previous]);
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onConnect={onConnect} onNodeClick={(_e, node) => select(node.id)} onPaneClick={() => select(null)} onNodesChange={changes => { for (const change of changes) if (change.type === 'position' && change.position) setPosition(change.id, change.position); else if (change.type === 'select' && change.selected) select(change.id); }} fitView fitViewOptions={{ padding: .4, maxZoom: 1.2 }} minZoom={.25} maxZoom={2} deleteKeyCode={null} proOptions={{ hideAttribution: false }} aria-label="Automaton graph editor">
    <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d9dfd5"/><Controls showInteractive={false}/>
  </ReactFlow>;
}
