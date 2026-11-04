# Harmonization verification

Verified locally on 2026-11-04 for the opt-in activity foundation, contract revision activity-v1-foundation-1. No remote CI, deployment, production event delivery, account linking or reward issuance is claimed.

- All four repositories pass npm run check:activity-contract: matching canonical/wire fixtures, stable event identities, exact Pipe field mapping, and shared implementation hashes.
- A cross-checkout smoke test exercised Puncher checkout plus volunteer award/void through the actual producer transformer and Stats batch consumer. Duplicate and reverse-order delivery preserved shop credit and removed volunteer credit.
- git diff --check passed. Integration settings remain absent from existing deployment configurations.

Production enablement requires the development AWS acceptance sequence in app-harmonization.md, including IAM and Pipe transformation, retry/DLQ recovery, stream replacement and canonical reconciliation. Verified identity linking, reward policies/ledger consumer, historical import, replay tooling and dashboard cutover are later milestones.

## FMEA checks

- Clean locked npm ci succeeded from an empty validation snapshot.
- npm run build passed for CDK, service and Angular production workspaces.
- Backend tests: 12 passed, including contract fixtures, transactional create/delete, replay, payload conflicts and capture-disabled reversal.
- Angular tests: 138 passed across 22 suites, including reuse of a submission key after failure.
- CDK tests: two passed with actual Lambda bundling. The locked SWC Jest transformer could not load its native binding under the Windows sandbox; a temporary TypeScript CommonJS transformer ran the same unmodified tests instead. The standard SWC test command remains an explicit Linux CI check.
- Existing PR validation now runs the expanded backend tests and shared contract checks; existing main-branch deployment behavior is unchanged.

## Implementation-machine adaptations

The Windows sandbox forbids workspace symlinks. Clean npm ci used a temporary filesystem adapter that materialized workspace source copies without changing dependency resolution. The lockfile adds 13 missing Windows optional native entries at their parent-declared versions; every existing lock entry is unchanged. A portable Node 24.22.2 and temporary Jest transformer were used outside this repository. Linux CI uses unmodified npm ci and the committed Jest configuration.
