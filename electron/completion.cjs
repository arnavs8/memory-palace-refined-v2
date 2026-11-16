const BASE = "https://openrouter.ai/api/v1";
const { parseJSON } = require("./analysis.cjs");

function failure(status, body, model) {
  const error = body?.error || {};
  const source = String(error.metadata?.limit_source || "");
  const detail = `${error.message || ""} ${error.metadata?.raw || ""}`;
  const daily = /per.day|daily|free_model_daily/i.test(source + detail);
  const upstream =
    /upstream|provider/i.test(source) ||
    /temporarily rate.limited|Provider returned error/i.test(detail);
  if (status === 429 && daily)
    return {
      retry: false,
      message:
        "Your OpenRouter daily free-request allowance is exhausted. Wait for its reset; changing models will not reset it.",
    };
  if (status === 429 && !upstream)
    return {
      retry: false,
      message:
        "OpenRouter is limiting requests for this account. Wait a minute before retrying. Changing models may not help.",
    };
  if (status === 401)
    return {
      retry: false,
      message: "OpenRouter rejected your API key. Update it in Free AI setup.",
    };
  if (status === 402)
    return {
      retry: false,
      message:
        "OpenRouter blocked this request under your account or key limits. A key spending cap does not add credit. No paid model was used.",
    };
  if (status === 403)
    return {
      retry: false,
      message:
        "OpenRouter denied this request. Check your account permissions and provider privacy settings.",
    };
  if (status === 404)
    return {
      retry: true,
      message: `No available endpoint for ${model}. Check OpenRouter provider privacy settings if this persists.`,
    };
  if ([429, 502, 503, 504].includes(status))
    return {
      retry: true,
      message: `The free provider for ${model} is temporarily unavailable (HTTP ${status}). Your API key may still be valid.`,
    };
  return {
    retry: false,
    message: `OpenRouter request failed (HTTP ${status}) for ${model}.`,
  };
}

function createCompletion({
  key,
  model,
  models,
  progress = () => {},
  fetcher = fetch,
}) {
  const available = new Set(models.map((m) => m.id));
  const preferred = [
    model,
    ...models.filter((m) => m.optionalReasoning).map((m) => m.id),
    ...models.map((m) => m.id),
  ];
  const pool = [...new Set(preferred)].filter(
    (id) =>
      available.has(id) && (id.endsWith(":free") || id === "openrouter/free"),
  );
  const blocked = new Set();
  const used = new Set();
  let requests = 0;
  let active = model;
  async function complete(system, prompt, signal) {
    const choices = [...new Set([active, ...pool])]
      .filter((id) => pool.includes(id) && !blocked.has(id))
      .slice(0, 3);
    let last = "No free models are currently available.";
    let retriedFormat = false;
    for (let attempt = 0; attempt < Math.min(3, choices.length); attempt++) {
      const candidate = choices[attempt];
      signal?.throwIfAborted();
      requests++;
      const response = await fetcher(BASE + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "X-Title": "Memory Palace",
        },
        body: JSON.stringify({
          model: candidate,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 6000,
          ...(models.find((m) => m.id === candidate)?.optionalReasoning
            ? { reasoning: { enabled: false } }
            : {}),
          provider: { max_price: { prompt: 0, completion: 0 } },
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.any([
          ...(signal ? [signal] : []),
          AbortSignal.timeout(180000),
        ]),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        const problem = failure(
          response.ok ? Number(result.error?.code || 502) : response.status,
          result,
          candidate,
        );
        if (!problem.retry) throw Error(problem.message);
        last = problem.message;
        blocked.add(candidate);
        progress(
          `${candidate} is unavailable. Trying another free model for this step…`,
        );
        continue;
      }
      if (result.choices?.[0]?.finish_reason === "length") {
        last = `The model ${candidate} exhausted its output allowance.`;
        blocked.add(candidate);
        progress(
          "Model output was cut short. Trying another free model for this step…",
        );
        continue;
      }
      const content = result.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        last = `The model ${candidate} returned no usable answer.`;
        blocked.add(candidate);
        progress(
          "The provider returned an empty answer. Trying another free model for this step…",
        );
        continue;
      }
      try {
        parseJSON(content);
      } catch {
        last = `The model ${candidate} returned invalid JSON.`;
        if (!retriedFormat) {
          choices.splice(attempt + 1, 0, candidate);
          retriedFormat = true;
          progress(
            "The model returned malformed study data. Retrying this step once…",
          );
        } else {
          blocked.add(candidate);
          progress("Study data is still malformed. Trying another free model…");
        }
        continue;
      }
      active = candidate;
      used.add(candidate);
      return content;
    }
    throw Error(
      `${last} Tried up to three free models for this step. Please retry later. No paid model was used.`,
    );
  }
  return { complete, stats: () => ({ requests, model: [...used].join(", ") }) };
}
module.exports = { createCompletion, failure };
