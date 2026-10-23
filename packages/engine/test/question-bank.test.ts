import { describe, expect, it } from 'vitest';
import { checkEquivalence, difficultyLevel, generateQuestion, minimizeDfa, QUESTION_BANK_SIZE, seedQuestions, topics, validateAutomaton } from '../src/index.js';
import storedBank from '../../../data/questions.json';

describe('balanced question bank', () => {
  it('reconstructs legacy API questions during a rolling update', () => {
    const legacy = generateQuestion('ends', 2, 100, 'v1');
    expect(legacy.id).toBe('ends-100-2');
    expect(legacy.prompt).toContain('“a”');
    expect(generateQuestion('ends', 2, 100).id).toMatch(/^v2-/);
  });
  it('contains 120 reproducible, valid questions with five of each level per topic', () => {
    const bank = seedQuestions();
    expect(bank).toHaveLength(QUESTION_BANK_SIZE);
    expect(new Set(bank.map(q => q.id)).size).toBe(120);
    expect(new Set(bank.map(q => q.prompt)).size).toBe(120);
    expect(storedBank).toEqual(bank);
    for (const topic of topics) {
      const group = bank.filter(q => q.topic === topic);
      expect(group).toHaveLength(15);
      for (const level of ['easy', 'medium', 'hard']) expect(group.filter(q => difficultyLevel(q.difficulty) === level)).toHaveLength(5);
      for (const [index, question] of group.entries()) {
        expect(validateAutomaton(question.reference)).toEqual([]);
        expect(question.reference.states.length).toBeLessThanOrEqual(16);
        expect(minimizeDfa(question.reference).automaton.states).toHaveLength(question.minimalStates);
        expect(generateQuestion(question.topic, question.difficulty, question.seed)).toEqual(question);
        for (const previous of group.slice(0, index)) {
          if (previous.minimalStates === question.minimalStates) expect(checkEquivalence(previous.reference, question.reference).equivalent).toBe(false);
        }
      }
    }
  }, 30000);
});
