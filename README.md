# PetClinic Jev Context Evaluator

This experiment tests whether TypeSafe Jev can select useful Java/Spring Boot
files for an engineering question. PetClinic REST remains unchanged; this
project reads files from a sibling checkout.

## Prerequisites

- Node.js 20+
- A cloned `spring-petclinic-rest` repository beside this directory, or an
	absolute path supplied through `PETCLINIC_ROOT`
- A TypeSafe API key for the full experiment run

Expected layout:

```text
jev-petclinic-lab/
├── spring-petclinic-rest/
└── context-evaluator/
```

The evaluator does not modify the PetClinic checkout. It reads the candidate
files listed in `data/test-cases.json` and sends their contents, along with the
engineering question, to TypeSafe Jev.

## Install and validate

```bash
npm install
npm run typecheck
npm run validate
```

`npm run typecheck` checks the TypeScript types. `npm run validate` builds the
project and verifies that every candidate file exists and can be read; it does
not call Jev and does not require an API key.

If PetClinic is elsewhere, set `PETCLINIC_ROOT` to its absolute path before
running validation or the experiment.

PowerShell:

```powershell
$env:PETCLINIC_ROOT="C:\path\to\spring-petclinic-rest"
```

## Run with Jev

PowerShell:

```powershell
$env:TYPESAFE_API_KEY="your-key"
npm start
```

macOS/Linux:

```bash
export TYPESAFE_API_KEY="your-key"
npm start
```

`npm start` builds the project, evaluates every candidate in
`data/test-cases.json`, prints a summary, and writes detailed results to
`results/experiment-<timestamp>.json`.

For a persistent local setup, you can put these values in a `.env` file in
this directory instead:

```text
TYPESAFE_API_KEY=your-key
PETCLINIC_ROOT=C:\path\to\spring-petclinic-rest
```

Do not commit `.env` files or API keys.

## Decision policy

Each candidate receives a Jev relevance label, evidence label, and source-role
label. The default policy is:

- `INCLUDE` when evidence is `DIRECT`, relevance is `HIGH`, and both
	confidence scores meet `CONFIDENCE_THRESHOLD`.
- `EXCLUDE` when evidence is `NONE` or relevance is `LOW`.
- `REVIEW` for all other cases.

The reported precision and recall measure the `INCLUDE` decisions against the
manually assigned `DIRECT` labels in the dataset. They are experiment metrics,
not proof that Jev will select the correct context for arbitrary questions.

## Tune the experiment

- Add manually labelled cases to `data/test-cases.json`.
- Change the policy threshold with `CONFIDENCE_THRESHOLD` (default `0.8`).
- Change maximum loaded file length with `MAX_FILE_CHARS` (default `50000`).
- Run the same dataset three times before drawing conclusions about stability.

`data/test-cases-small.json` is available for a quicker local smoke test when
you want to reduce the number of API calls. To use another dataset, update the
dataset path in `src/run-experiment.ts` before building.

## Troubleshooting

- `TYPESAFE_API_KEY is not set`: run `npm run validate` for an offline check,
	or set `TYPESAFE_API_KEY` before running `npm start`.
- A candidate file cannot be read: confirm that `PETCLINIC_ROOT` points to the
	root of the PetClinic checkout and rerun `npm run validate`.
- `CONFIDENCE_THRESHOLD` must be between `0` and `1`; `MAX_FILE_CHARS` must be
	at least `1000`.

Do not commit API keys or use proprietary source code in this public experiment.
