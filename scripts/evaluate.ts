import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { checkEquivalence, diagnose, applyEdit, moduloAutomaton, mutateAutomaton, randomSource, seedQuestions, simulate } from '../packages/engine/src/index.js';
import { enumerateStrings } from '../packages/engine/test/helpers.js';
import { HintService, leaksSolution } from '../apps/api/src/hints.js';
const start = performance.now();
const random = randomSource(194);
let agreement = 0, recovered = 0, injectedRecovery = 0;
const words = enumerateStrings(['a', 'b'], 10);
for (let i = 0; i < 550; i++) {
  const a = moduloAutomaton(1 + Math.floor(random() * 3), 0, 'a');
  const b = mutateAutomaton(a, i, i % 2 ? 1 : 2).automaton;
  const result = checkEquivalence(a, b);
  const witness = words.find(word => simulate(a, word).accepted !== simulate(b, word).accepted);
  if (result.equivalent === (witness === undefined) && (result.equivalent || result.counterexample === witness)) agreement++;
}
const equivalenceMs = performance.now() - start;
const diagnosisStart = performance.now();
for (let i = 0; i < 100; i++) {
  const reference = moduloAutomaton(3, i % 3, 'a');
  const mutation = mutateAutomaton(reference, i, i % 2 ? 1 : 2);
  const repair = diagnose(mutation.automaton, reference, { timeoutMs: 1000 });
  if (repair && checkEquivalence(repair.reduce(applyEdit, mutation.automaton), reference).equivalent) recovered++;
  if (repair && JSON.stringify(repair.reduce(applyEdit, mutation.automaton)) === JSON.stringify(reference)) injectedRecovery++;
}
let leakFailures = 0, ollamaResponses = 0;
const diagnosisMs = performance.now() - diagnosisStart;
const live = process.argv.includes('--live');
const service = new HintService();
for (let i = 0; i < 100; i++) {
  const reference = moduloAutomaton(2, 0, 'a'), level = 1 + i % 3;
  if (live) {
    const hint = await service.get({ questionId: `evaluation-${i}`, question: 'Accept an even count of a.', level, reference, misconception: 'WRONG_FINAL_STATE', edits: [{ type: 'toggleFinal', state: 'q0' }], result: { equivalent: false, counterexample: '', shouldAccept: true } });
    if (hint.source === 'ollama') ollamaResponses++;
    if (leaksSolution(hint.text, level, reference)) leakFailures++;
  } else if (!leaksSolution(['Change the accepting state.', '| state | a | b |', '(q0,a,q1)', 'q0 → q1', 'transitions: []'][i % 5] ?? '', level, reference)) leakFailures++;
  if (live && (i + 1) % 10 === 0) console.log(`Live hints: ${i + 1}/100; Ollama responses accepted: ${ollamaResponses}`);
}
const report = { equivalence: { agreement, pairs: 550, maxLength: 10, milliseconds: Math.round(equivalenceMs) }, diagnosis: { recovered, total: 100, exactOriginalRestored: injectedRecovery, milliseconds: Math.round(diagnosisMs) }, hints: { mode: live ? 'live Ollama with fallback' : '100 adversarial fixtures (not live model generation)', leakFailures, ollamaResponses }, seedQuestions: seedQuestions().length, totalMilliseconds: Math.round(performance.now() - start) };
await mkdir('artifacts', { recursive: true });
await writeFile(`artifacts/evaluation${live ? '-live' : ''}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (agreement !== 550 || recovered < 95 || leakFailures) process.exitCode = 1;
