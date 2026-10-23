import type { Automaton, Edit, EquivalenceResult, Misconception } from '@tutor/engine';
export type Verification = { result: EquivalenceResult; edits: Edit[] | null; misconception: Misconception };
export function verify(automaton: Automaton, reference: Automaton): Promise<Verification> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    const timer = window.setTimeout(() => { worker.terminate(); reject(new Error('Verification exceeded five seconds. Try a smaller machine.')); }, 5000);
    worker.onmessage = (event: MessageEvent<Verification & { error?: string }>) => { clearTimeout(timer); worker.terminate(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data); };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error('Could not start the verification engine.')); };
    worker.postMessage({ automaton, reference });
  });
}
