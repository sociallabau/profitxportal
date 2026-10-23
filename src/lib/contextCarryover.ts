import type { ContextAnswers } from './contextRoom';

// An existing key, including an intentionally cleared answer, always wins.
export function carryOverContext(answers: ContextAnswers, businessOverview?: string | null): ContextAnswers {
  if (Object.prototype.hasOwnProperty.call(answers, 'customer_problem') || !businessOverview?.trim()) return answers;
  return { ...answers, customer_problem: businessOverview };
}