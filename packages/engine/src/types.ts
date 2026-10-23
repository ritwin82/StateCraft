export type Automaton = {
  kind: "DFA" | "NFA" | "ENFA";
  states: string[];
  alphabet: string[];
  start: string;
  finals: string[];
  transitions: { from: string; symbol: string; to: string }[];
};
export type ValidationIssue = { code: string; message: string };
export type TraceStep = {
  kind: "start" | "consume" | "epsilon";
  symbol: string | null;
  activeStates: string[];
};
export type SimulationResult = { accepted: boolean; trace: TraceStep[] };
export type SubsetStep = {
  from: string; symbol: string; to: string; members: string[]; discovered: boolean;
};
export type SubsetResult = {
  automaton: Automaton; subsets: Record<string, string[]>; steps: SubsetStep[];
};
export type MinimizationResult = { automaton: Automaton; partitions: string[][][] };
