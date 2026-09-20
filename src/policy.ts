import type { JevEvaluation } from "./evaluate-with-jev.js";

export type PolicyAction = "INCLUDE" | "REVIEW" | "EXCLUDE";

export interface PolicyDecision {
  action: PolicyAction;
  reason: string;
  decisionConfidence: number;
}

export function applyContextPolicy(
  evaluation: JevEvaluation,
  confidenceThreshold = 0.8,
): PolicyDecision {
  const decisionConfidence = Math.min(
    evaluation.relevance.confidence,
    evaluation.evidence.confidence,
  );

  if (evaluation.evidence.choice === "NONE" || evaluation.relevance.choice === "LOW") {
    return {
      action: "EXCLUDE",
      reason: "Jev found no meaningful evidence or low relevance.",
      decisionConfidence,
    };
  }

  if (
    evaluation.evidence.choice === "DIRECT" &&
    evaluation.relevance.choice === "HIGH" &&
    decisionConfidence >= confidenceThreshold
  ) {
    return {
      action: "INCLUDE",
      reason: "Direct, highly relevant evidence cleared the confidence threshold.",
      decisionConfidence,
    };
  }

  return {
    action: "REVIEW",
    reason: "The evidence is indirect, moderately relevant, or below the confidence threshold.",
    decisionConfidence,
  };
}
