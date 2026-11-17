const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../bridge/server.cjs");
const token = "test-session-token-at-least-32-characters";
async function fixture(t, overrides = {}) {
  let calls = 0;
  const server = createServer({
    token,
    api: {
      status: async () => ({ configured: true, model: "example:free" }),
      cancel: async () => true,
      analyze: async (input, progress) => {
        calls++;
        progress("Analyzing");
        return { cards: [{ title: "Force" }] };
      },
      ...overrides,
    },
    readFile: async () => [
      {
        source: "test.pdf",
        page: 1,
        text: "A sufficiently long definition of mechanics.",
      },
    ],
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls: () => calls,
  };
}
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};
test("local bridge rejects unauthenticated callers and browser origins", async (t) => {
  const f = await fixture(t);
  assert.equal((await fetch(f.url + "/status")).status, 403);
  assert.equal(
    (
      await fetch(f.url + "/status", {
        headers: { ...headers, Origin: "https://example.com" },
      })
    ).status,
    403,
  );
  const status = await (await fetch(f.url + "/status", { headers })).json();
  assert.equal(status.configured, true);
  assert.equal("key" in status, false);
});
test("analysis requires consent and exposes completed cards through polling", async (t) => {
  const f = await fixture(t);
  const input = { filePath: "C:/test.pdf", objective: "Mechanics" };
  assert.equal(
    (
      await fetch(f.url + "/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      })
    ).status,
    400,
  );
  assert.equal(f.calls(), 0);
  assert.equal(
    (
      await fetch(f.url + "/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...input, consent: true }),
      })
    ).status,
    202,
  );
  const state = await (await fetch(f.url + "/status", { headers })).json();
  assert.equal(state.job.state, "complete");
  assert.equal(state.job.result.cards[0].title, "Force");
  assert.equal(f.calls(), 1);
});
test("concurrent analysis is rejected and cancel reaches the active job", async (t) => {
  let finish,
    cancelled = false;
  const f = await fixture(t, {
    analyze: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    cancel: async () => {
      cancelled = true;
      finish({ cards: [] });
    },
  });
  const request = () =>
    fetch(f.url + "/analyze", {
      method: "POST",
      headers,
      body: JSON.stringify({
        filePath: "C:/test.pdf",
        objective: "Mechanics",
        consent: true,
      }),
    });
  assert.equal((await request()).status, 202);
  assert.equal((await request()).status, 409);
  assert.equal(
    (await fetch(f.url + "/cancel", { method: "POST", headers })).status,
    200,
  );
  assert.equal(cancelled, true);
});
test("provider failure is visible without leaking key material", async (t) => {
  const f = await fixture(t, {
    analyze: async () => {
      throw Error("Free provider unavailable");
    },
  });
  await fetch(f.url + "/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify({
      filePath: "C:/test.pdf",
      objective: "Mechanics",
      consent: true,
    }),
  });
  const state = await (await fetch(f.url + "/status", { headers })).json();
  assert.equal(state.job.state, "failed");
  assert.equal(state.job.progress, "Free provider unavailable");
});
