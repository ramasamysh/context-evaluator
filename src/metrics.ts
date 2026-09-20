import type { EvidenceLabel } from "./load-file.js";
import type { PolicyAction } from "./policy.js";

export interface ExperimentResult {
  testCaseId: string;
  question: string;
  candidatePath: string;
  expectedEvidence: EvidenceLabel;
  predictedEvidence: EvidenceLabel;
  predictedRelevance: "HIGH" | "MEDIUM" | "LOW";
  sourceRole: "IMPLEMENTATION" | "TEST" | "CONFIGURATION" | "DOCUMENTATION" | "UNKNOWN";
  action: PolicyAction;
  decisionConfidence: number;
  latencyMs: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  probabilities: {
    relevance: Record<string, number>;
    evidence: Record<string, number>;
    sourceRole: Record<string, number>;
  };
}

export interface ExperimentMetrics {
  totalCandidates: number;
  evidenceAccuracy: number;
  includePrecision: number;
  includeRecall: number;
  falseInclusions: number;
  falseExclusions: number;
  averageLatencyMs: number;
  averageDecisionConfidence: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function calculateMetrics(results: ExperimentResult[]): ExperimentMetrics {
  const correctEvidence = results.filter(
    (result) => result.expectedEvidence === result.predictedEvidence,
  ).length;

  const included = results.filter((result) => result.action === "INCLUDE");
  const expectedDirect = results.filter((result) => result.expectedEvidence === "DIRECT");
  const correctlyIncluded = included.filter(
    (result) => result.expectedEvidence === "DIRECT",
  ).length;
  const falseInclusions = included.filter(
    (result) => result.expectedEvidence !== "DIRECT",
  ).length;
  const falseExclusions = results.filter(
    (result) => result.expectedEvidence === "DIRECT" && result.action === "EXCLUDE",
  ).length;

  return {
    totalCandidates: results.length,
    evidenceAccuracy: divide(correctEvidence, results.length),
    includePrecision: divide(correctlyIncluded, included.length),
    includeRecall: divide(correctlyIncluded, expectedDirect.length),
    falseInclusions,
    falseExclusions,
    averageLatencyMs: divide(
      results.reduce((sum, result) => sum + result.latencyMs, 0),
      results.length,
    ),
    averageDecisionConfidence: divide(
      results.reduce((sum, result) => sum + result.decisionConfidence, 0),
      results.length,
    ),
    totalInputTokens: results.reduce((sum, result) => sum + result.inputTokens, 0),
    totalOutputTokens: results.reduce((sum, result) => sum + result.outputTokens, 0),
  };
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
