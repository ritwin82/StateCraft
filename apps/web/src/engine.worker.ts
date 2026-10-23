import { checkEquivalence, classifyMisconception, diagnose } from '@tutor/engine';
import type { Automaton } from '@tutor/engine';
self.onmessage = (event: MessageEvent<{ automaton: Automaton; reference: Automaton }>) => {
  try {
    const { automaton, reference } = event.data;
    const result = checkEquivalence(automaton, reference);
    const edits = result.equivalent ? [] : diagnose(automaton, reference, { timeoutMs: 400 });
    self.postMessage({ result, edits, misconception: classifyMisconception(edits, automaton, reference) });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Verification failed.' }); }
};
