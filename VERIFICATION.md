# Verification record — v2.1.0

Verified locally on Windows x64, 16 November 2026.

- TypeScript compilation and production build passed.
- All 16 core, analysis-contract and procedural-layout tests passed.
- All four browser integration cases passed, including real TXT/PDF imports, editing, learn/test/persistence, validation, and carnival multi-wing navigation. Graphics cases were run sequentially on this machine.
- Packaged Electron smoke test passed: create, learn, test, reload, PDF import and persistent library.
- Desktop AI integration passed with an explicitly mocked OpenRouter provider: key encryption, connection check, two-pass analysis, review, physical recall placement and key removal.
- The live free-model catalogue was checked. Authenticated model inference and academic extraction quality have NOT been evaluated with a real user API key.
- Packaged security preferences verified: sandbox and context isolation enabled; Node integration disabled.
- Both environment previews were rendered and inspected.

These checks establish functional behavior, not educational efficacy or performance across a broad device matrix. AI output requires learner review. See docs/AI-SETUP.md and README.md for limitations.

## v2.1.1 follow-up — 17 November 2026

- 23 unit and contract checks passed, including provider fallback, account-limit handling, malformed/empty output, cancellation, free-only routing and source-ID binding.
- Live authenticated analysis of a 19-page PDF completed with 15 concepts in four requests; one candidate was rejected. This verifies this example, not general educational accuracy.
- Earlier live attempts reproduced upstream HTTP 429 and reasoning-output exhaustion. The fix addresses these independently of key validity.
- Packaged desktop smoke test passed: PDF import, learning, recall, persistence and sandbox preferences.
