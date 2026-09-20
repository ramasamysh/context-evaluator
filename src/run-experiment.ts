import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JevEvaluator } from "./evaluate-with-jev.js";
import { loadCandidate, loadTestCases } from "./load-file.js";
import { calculateMetrics, formatPercent, type ExperimentResult } from "./metrics.js";
import { applyContextPolicy } from "./policy.js";

import "dotenv/config";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(sourceDirectory, "..");
const datasetPath = path.resolve(projectRoot, "data/test-cases.json");
const resultsDirectory = path.resolve(projectRoot, "results");
const petclinicRoot = path.resolve(
  process.env.PETCLINIC_ROOT ?? path.join(projectRoot, "../spring-petclinic-rest"),
);
const validateOnly = process.argv.includes("--validate-only");
const confidenceThreshold = Number.parseFloat(process.env.CONFIDENCE_THRESHOLD ?? "0.8");

if (!Number.isFinite(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1) {
  throw new Error("CONFIDENCE_THRESHOLD must be between 0 and 1.");
}

async function main(): Promise<void> {
  const testCases = await loadTestCases(datasetPath);
  const totalCandidates = testCases.reduce(
    (total, testCase) => total + testCase.candidates.length,
    0,
  );

  console.log(`PetClinic root: ${petclinicRoot}`);
  console.log(`Loaded ${testCases.length} test cases and ${totalCandidates} candidates.`);

  if (validateOnly) {
    for (const testCase of testCases) {
      for (const candidate of testCase.candidates) {
        await loadCandidate(petclinicRoot, candidate);
      }
    }
    console.log("Validation passed: every candidate file exists and can be read.");
    return;
  }

  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error(
      "TYPESAFE_API_KEY is not set. Set it in your terminal, then run npm start. " +
        "Use npm run validate to check the dataset without calling Jev.",
    );
  }

  const evaluator = new JevEvaluator();
  const results: ExperimentResult[] = [];

  for (const testCase of testCases) {
    console.log(`\n[${testCase.id}] ${testCase.question}`);

    for (const candidateDefinition of testCase.candidates) {
      const candidate = await loadCandidate(petclinicRoot, candidateDefinition);
      const evaluation = await evaluator.evaluate(testCase.question, candidate);
      const decision = applyContextPolicy(evaluation, confidenceThreshold);

      const result: ExperimentResult = {
        testCaseId: testCase.id,
        question: testCase.question,
        candidatePath: candidate.path,
        expectedEvidence: candidate.expectedEvidence,
        predictedEvidence: evaluation.evidence.choice,
        predictedRelevance: evaluation.relevance.choice,
        sourceRole: evaluation.sourceRole.choice,
        action: decision.action,
        decisionConfidence: decision.decisionConfidence,
        latencyMs: evaluation.latencyMs,
        model: evaluation.model,
        inputTokens: evaluation.inputTokens,
        outputTokens: evaluation.outputTokens,
        probabilities: {
          relevance: evaluation.relevance.probabilities,
          evidence: evaluation.evidence.probabilities,
          sourceRole: evaluation.sourceRole.probabilities,
        },
      };

      results.push(result);
      console.log(
        `  ${decision.action.padEnd(7)} ${evaluation.evidence.choice.padEnd(8)} ` +
          `confidence=${decision.decisionConfidence.toFixed(3)} ` +
          `latency=${evaluation.latencyMs.toFixed(0)}ms ${candidate.path}`,
      );
    }
  }

  const metrics = calculateMetrics(results);
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const outputPath = path.join(resultsDirectory, `experiment-${timestamp}.json`);

  await mkdir(resultsDirectory, { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        petclinicRoot,
        confidenceThreshold,
        metrics,
        results,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("\nSummary");
  console.table({
    candidates: metrics.totalCandidates,
    evidenceAccuracy: formatPercent(metrics.evidenceAccuracy),
    includePrecision: formatPercent(metrics.includePrecision),
    includeRecall: formatPercent(metrics.includeRecall),
    falseInclusions: metrics.falseInclusions,
    falseExclusions: metrics.falseExclusions,
    averageLatencyMs: metrics.averageLatencyMs.toFixed(1),
    averageConfidence: formatPercent(metrics.averageDecisionConfidence),
    inputTokens: metrics.totalInputTokens,
    outputTokens: metrics.totalOutputTokens,
  });
  console.log(`Detailed results: ${outputPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Experiment failed: ${message}`);
  process.exitCode = 1;
});
