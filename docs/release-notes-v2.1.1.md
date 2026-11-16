# Memory Palace 2.1.1 — Free AI reliability fix

Fixes failures encountered while importing a real 19-page study PDF.

- Temporary provider-capacity errors, empty answers and truncated output try other verified free models, up to three attempts per step. Successfully completed reading steps are retained during these retries.
- Malformed JSON gets one retry within the same attempt limit. Daily quota and account-limit errors stop with specific explanations.
- Models that allow optional reasoning disable it for structured extraction, preserving the output allowance for study cards.
- Source references use IDs bound to actual PDF excerpts and pages. This avoids rejecting useful concepts merely because a model repaired damaged PDF spacing while reproducing a quote.
- Key verification no longer implies that a model has available inference capacity. Request estimates explain possible extra attempts.

Validation: 23 unit/contract tests passed. A live 19-page PDF import produced 15 study concepts in four requests using Dots3-Note Preview (free); one invalid candidate was excluded. Free-provider availability still fluctuates, and source references do not guarantee every generated explanation is correct.

Close the old version and run this installer or portable executable. The app does not update automatically. The saved API key and local library remain in the same app profile. No paid-model fallback is enabled.
