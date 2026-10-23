import { describe, expect, it } from 'vitest';
import { asDfa, checkEquivalence, difficultyLevel, generateQuestion, minimizeDfa, QUESTION_BANK_SIZE, seedQuestions, topics, validateAutomaton } from '../src/index.js';
import storedBank from '../../../data/questions.json';

describe('balanced question bank', () => {
  it('reconstructs legacy API questions during a rolling update', () => {
    const legacy = generateQuestion('ends', 2, 100, 'v1');
    expect(legacy.id).toBe('ends-100-2');
    expect(legacy.prompt).toContain('“a”');
    expect(generateQuestion('ends', 2, 100).id).toMatch(/^v2-/);
  });
  it('contains 150 reproducible, valid questions with five of each level per topic', () => {
    const bank = seedQuestions();
    expect(bank).toHaveLength(QUESTION_BANK_SIZE);
    expect(new Set(bank.map(q => q.id)).size).toBe(150);
    expect(new Set(bank.map(q => q.prompt)).size).toBe(150);
    expect(storedBank).toEqual(bank);
    for (const topic of topics) {
      const group = bank.filter(q => q.topic === topic);
      expect(group).toHaveLength(15);
      for (const level of ['easy', 'medium', 'hard']) expect(group.filter(q => difficultyLevel(q.difficulty) === level)).toHaveLength(5);
      for (const [index, question] of group.entries()) {
        expect(validateAutomaton(question.reference)).toEqual([]);
        if (topic === 'nfa' || topic === 'enfa') {
          expect(question.reference.kind).toBe(topic === 'nfa' ? 'NFA' : 'ENFA');
          expect(question.reference.states.length).toBeLessThanOrEqual(8);
          expect(question.reference.transitions.some(t => t.symbol === 'ε')).toBe(topic === 'enfa');
          if (topic === 'nfa') expect(question.reference.transitions.some(t => question.reference.transitions.some(other => other.from === t.from && other.symbol === t.symbol && other.to !== t.to))).toBe(true);
        }
        expect(question.reference.states.length).toBeLessThanOrEqual(16);
        expect(minimizeDfa(asDfa(question.reference)).automaton.states).toHaveLength(question.minimalStates);
        expect(generateQuestion(question.topic, question.difficulty, question.seed)).toEqual(question);
        for (const previous of group.slice(0, index)) {
          if (previous.minimalStates === question.minimalStates) expect(checkEquivalence(previous.reference, question.reference).equivalent).toBe(false);
        }
      }
    }
  }, 30000);
});
