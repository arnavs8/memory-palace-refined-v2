# Free cloud AI setup

Open **Free AI setup** in Memory Palace's sidebar.

1. Click **Open API key page**. It opens [OpenRouter's key settings](https://openrouter.ai/settings/keys) in your browser.
2. Sign in or create an account, choose **Create key**, name it `Memory Palace`, and copy the key. Keep it private; paste it into the app, not into a chat or GitHub issue.
3. Choose a free model, then **Save & check connection**. The key is encrypted using Electron safeStorage / Windows DPAPI. The app shows the free daily request balance when OpenRouter supplies it.
4. Create a palace, add your PDF or notes, describe the exam/course goal, and choose a target number of concepts.
5. Select **AI concept analysis** and confirm text sharing. The app sends extracted document text to OpenRouter and its selected inference provider. Their data policies apply; the setup screen links to privacy settings.
6. Review the selected concepts, practice questions, rationale and source evidence before building the palace.

The model picker is populated from the live catalogue and only admits explicitly free routes with zero listed prices. It prefers showing Qwen entries first when present. On 16 November 2026 the catalogue checked for this release did not contain a free Qwen entry. **Free Models Router** (`openrouter/free`) can select another model family; it is not a promise to use Qwen.

No paid fallback is configured. A model that disappears from the free catalogue is rejected before analysis. Free access has rate limits, daily quotas, and provider capacity constraints. A document consumes one request per reading batch plus one synthesis request. The app shows an estimate; it does not automatically retry failed calls. A failed or cancelled analysis may still consume provider quota. See [OpenRouter's free model documentation](https://openrouter.ai/docs/guides/routing/model-variants/free) and [limits](https://openrouter.ai/docs/api_reference/limits).

## What the analysis does

The first stage identifies definitions, mechanisms, comparisons, formulas and other central ideas, guided by the study objective. It generates a concise explanation, a plausible practice question, an importance rationale, a topic, a mnemonic suggestion and an exact supporting quote. Quotes and page references are checked against the original extracted text; invalid candidates are excluded.

The second stage chooses concepts across the candidate set, removes overlap, groups related topics and orders prerequisites before advanced ideas. It returns a coverage summary. This is study assistance, not a prediction of actual exam questions. Quote matching verifies provenance, not every statement in the generated explanation: users must still review the cards. Scanned images and diagrams require separate OCR/transcription.

There is no silent fallback to paragraph splitting. **Manual passage import** is a separate, explicitly selected offline option. Learning and recall work offline after the palace is saved. Backups contain study content and placements, never API keys.

## Verification boundary

The live public model catalogue was checked. Automated inference tests use a labelled mock provider: no user API key was available during development, so live authenticated generation quality has not been measured for this release. The packaged integration checks key encryption, the complete analysis/review/build flow, correct spatial recall, and key removal.
