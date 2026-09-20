import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

import type { EvidenceLabel, LoadedCandidate } from "./load-file.js";

export const RELEVANCE_LABELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type RelevanceLabel = (typeof RELEVANCE_LABELS)[number];

export const SOURCE_ROLES = [
  "IMPLEMENTATION",
  "TEST",
  "CONFIGURATION",
  "DOCUMENTATION",
  "UNKNOWN",
] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

export interface ChoiceSnapshot<T extends string> {
  choice: T;
  confidence: number;
  probabilities: Record<T, number>;
}

export interface JevEvaluation {
  relevance: ChoiceSnapshot<RelevanceLabel>;
  evidence: ChoiceSnapshot<EvidenceLabel>;
  sourceRole: ChoiceSnapshot<SourceRole>;
  latencyMs: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const questions = {
  relevance: choice(
    "How relevant is `file.content` to answering `engineeringQuestion`? Judge the actual content, not only the filename.",
    {
      HIGH: "Central to answering the question.",
      MEDIUM: "Provides useful supporting information but is not sufficient by itself.",
      LOW: "Does not materially help answer the question.",
    },
  ),
  evidence: choice(
    "What strength of evidence does `file.content` provide for answering `engineeringQuestion`?",
    {
      DIRECT: "Directly implements, defines, configures, documents, or verifies the requested behavior.",
      INDIRECT: "Provides a related type, dependency, mapping, test, or supporting behavior.",
      NONE: "Provides no meaningful evidence for the requested behavior.",
    },
  ),
  sourceRole: choice(
    "What is the primary role of `file.content` in this software project?",
    {
      IMPLEMENTATION: "Production source code that implements application behavior.",
      TEST: "Automated test code or test fixtures.",
      CONFIGURATION: "Runtime, build, security, database, or framework configuration.",
      DOCUMENTATION: "Human-readable documentation or an API specification.",
      UNKNOWN: "None of the other roles clearly applies.",
    },
  ),
};

export class JevEvaluator {
  private readonly client: TypeSafeClient;

  constructor(client = new TypeSafeClient()) {
    this.client = client;
  }

  async evaluate(question: string, candidate: LoadedCandidate): Promise<JevEvaluation> {
    const state = {
      engineeringQuestion: question,
      file: {
        path: candidate.path,
        content: candidate.content,
        truncated: candidate.truncated,
      },
    };

    const startedAt = performance.now();
    const response = await this.client.systemOne({ state, questions });
    const latencyMs = performance.now() - startedAt;

    return {
      relevance: {
        choice: response.answers.relevance.choice,
        confidence: response.answers.relevance.confidence,
        probabilities: { ...response.answers.relevance.probabilities },
      },
      evidence: {
        choice: response.answers.evidence.choice,
        confidence: response.answers.evidence.confidence,
        probabilities: { ...response.answers.evidence.probabilities },
      },
      sourceRole: {
        choice: response.answers.sourceRole.choice,
        confidence: response.answers.sourceRole.confidence,
        probabilities: { ...response.answers.sourceRole.probabilities },
      },
      latencyMs,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
