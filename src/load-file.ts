import { readFile } from "node:fs/promises";
import path from "node:path";

export const EVIDENCE_LABELS = ["DIRECT", "INDIRECT", "NONE"] as const;
export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

export interface CandidateDefinition {
  path: string;
  expectedEvidence: EvidenceLabel;
}

export interface TestCaseDefinition {
  id: string;
  question: string;
  candidates: CandidateDefinition[];
}

export interface LoadedCandidate extends CandidateDefinition {
  absolutePath: string;
  content: string;
  truncated: boolean;
}

function isEvidenceLabel(value: unknown): value is EvidenceLabel {
  return typeof value === "string" && EVIDENCE_LABELS.includes(value as EvidenceLabel);
}

function validateTestCases(value: unknown): asserts value is TestCaseDefinition[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("test-cases.json must contain a non-empty array.");
  }

  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      throw new Error("Every test case must be an object.");
    }

    const testCase = item as Partial<TestCaseDefinition>;
    if (!testCase.id || !testCase.question || !Array.isArray(testCase.candidates)) {
      throw new Error("Every test case needs id, question, and candidates fields.");
    }

    for (const candidate of testCase.candidates) {
      if (!candidate.path || !isEvidenceLabel(candidate.expectedEvidence)) {
        throw new Error(`Invalid candidate in test case ${testCase.id}.`);
      }
    }
  }
}

export async function loadTestCases(datasetPath: string): Promise<TestCaseDefinition[]> {
  const raw = await readFile(datasetPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  validateTestCases(parsed);
  return parsed;
}

export async function loadCandidate(
  petclinicRoot: string,
  candidate: CandidateDefinition,
): Promise<LoadedCandidate> {
  const root = path.resolve(petclinicRoot);
  const absolutePath = path.resolve(root, candidate.path);
  const relative = path.relative(root, absolutePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Candidate path escapes PETCLINIC_ROOT: ${candidate.path}`);
  }

  const content = await readFile(absolutePath, "utf8");
  const maxChars = Number.parseInt(process.env.MAX_FILE_CHARS ?? "50000", 10);

  if (!Number.isFinite(maxChars) || maxChars < 1000) {
    throw new Error("MAX_FILE_CHARS must be an integer of at least 1000.");
  }

  const truncated = content.length > maxChars;
  return {
    ...candidate,
    absolutePath,
    content: truncated
      ? `${content.slice(0, maxChars)}\n\n/* FILE TRUNCATED BY EVALUATOR */`
      : content,
    truncated,
  };
}
