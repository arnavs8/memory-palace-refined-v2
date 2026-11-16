const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCompletion } = require("../electron/completion.cjs");
const models = [
  { id: "google/test:free" },
  { id: "baidu/ernie:free" },
  { id: "dots/test:free" },
  { id: "paid/model" },
];
const good = () =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }],
    }),
  );
test("retries provider capacity on another free model and keeps working model for next batch", async () => {
  const calls = [];
  const c = createCompletion({
    key: "secret",
    model: models[0].id,
    models,
    fetcher: async (_u, o) => {
      const b = JSON.parse(o.body);
      calls.push(b.model);
      assert.deepEqual(b.provider.max_price, { prompt: 0, completion: 0 });
      return calls.length === 1
        ? new Response(
            JSON.stringify({
              error: {
                metadata: { limit_source: "upstream_provider_shared_pool" },
              },
            }),
            { status: 429 },
          )
        : good();
    },
  });
  await c.complete("s", "p");
  await c.complete("s", "p");
  assert.deepEqual(calls, [models[0].id, models[1].id, models[1].id]);
  assert.equal(c.stats().requests, 3);
  assert.equal(c.stats().model, models[1].id);
});
test("daily quota and account failures do not burn retries", async () => {
  for (const status of [401, 402, 403, 429]) {
    let n = 0;
    const c = createCompletion({
      key: "s",
      model: models[0].id,
      models,
      fetcher: async () => {
        n++;
        return new Response(
          JSON.stringify({
            error: { message: "Rate limit exceeded: free-models-per-day" },
          }),
          { status },
        );
      },
    });
    await assert.rejects(c.complete("s", "p"));
    assert.equal(n, 1);
  }
});
test("empty responses and output truncation try alternatives with three-attempt bound", async () => {
  let n = 0;
  const c = createCompletion({
    key: "s",
    model: models[0].id,
    models,
    fetcher: async () => {
      n++;
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: n === 1 ? "length" : "stop",
              message: { content: "" },
            },
          ],
        }),
      );
    },
  });
  await assert.rejects(c.complete("s", "p"), /three free models/);
  assert.equal(n, 3);
});
test("cancelled requests never reach provider", async () => {
  const a = new AbortController();
  a.abort();
  const c = createCompletion({
    key: "s",
    model: models[0].id,
    models,
    fetcher: () => assert.fail("Unexpected request"),
  });
  await assert.rejects(c.complete("s", "p", a.signal), /aborted/);
});
test("malformed JSON retries once without restarting prior batches", async () => {
  let n = 0;
  const c = createCompletion({
    key: "s",
    model: models[0].id,
    models,
    fetcher: async () => {
      n++;
      return n === 1
        ? new Response(
            JSON.stringify({
              choices: [
                { finish_reason: "stop", message: { content: "broken {" } },
              ],
            }),
          )
        : good();
    },
  });
  await c.complete("s", "p");
  assert.equal(n, 2);
});
test("paid model IDs are never submitted even if present in catalogue input", async () => {
  const c = createCompletion({
    key: "s",
    model: "paid/model",
    models,
    fetcher: async (_u, o) => {
      assert.match(JSON.parse(o.body).model, /:free$/);
      return good();
    },
  });
  await c.complete("s", "p");
});
