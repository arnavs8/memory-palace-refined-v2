const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  analyze,
  validateCandidates,
  batches,
  parseJSON,
} = require("../electron/analysis.cjs");
const { isFree, getModels } = require("../electron/ai.cjs");
const pages = [
  {
    source: "biology.pdf",
    page: 3,
    text: "Photosynthesis converts light energy into chemical energy. Chlorophyll absorbs light in the chloroplast. Published by Example Press, 2025.",
  },
];
const concept = {
  title: "Photosynthesis",
  body: "Plants transform light energy into chemical energy using chlorophyll.",
  question: "Explain the energy conversion in photosynthesis.",
  topic: "Plant metabolism",
  importance: "core",
  rationale: "A central mechanism linking light to plant nutrition.",
  mnemonic: "Imagine a lantern pouring sunlight into a sugar bowl.",
  category: "energy",
  pageIndex: 0,
  evidence: "Photosynthesis converts light energy into chemical energy.",
};
test("two-stage analysis selects meaningful concepts with preserved evidence", async () => {
  let calls = 0;
  const complete = async (_system, prompt) => {
    calls++;
    if (calls === 1) return JSON.stringify({ cards: [concept] });
    const id = JSON.parse(prompt.slice(prompt.indexOf("[{")))[0].id;
    return JSON.stringify({
      selectedIds: [id],
      coverage: "Photosynthesis mechanism; no publisher metadata.",
    });
  };
  const result = await analyze(
    pages,
    { target: 4, objective: "Explain biological mechanisms" },
    complete,
  );
  assert.equal(calls, 2);
  assert.equal(result.cards[0].source, "biology.pdf");
  assert.equal(result.cards[0].page, 3);
  assert.equal(result.cards[0].question, concept.question);
  assert.equal(result.cards[0].category, "energy");
  assert.equal(result.cards.length, 1);
});
test("fabricated quotations, incorrect citations, and malformed fields are excluded", () => {
  const result = validateCandidates(
    {
      cards: [
        {
          ...concept,
          evidence:
            "This fabricated claim is not present in the original document.",
        },
        { ...concept, pageIndex: 12 },
        { ...concept, question: 5 },
        concept,
      ],
    },
    pages,
    new Set([0]),
  );
  assert.equal(result.rejected, 3);
  assert.equal(result.cards.length, 1);
});
test("fails rather than silently substituting raw passages", async () => {
  await assert.rejects(
    analyze(pages, { target: 4 }, async () =>
      JSON.stringify({
        cards: [
          {
            ...concept,
            evidence: "This is a fabricated quotation which must be rejected.",
          },
        ],
      }),
    ),
    /no concepts/,
  );
  assert.throws(() => parseJSON("not json"), /invalid JSON/);
});
test("invalid synthesis IDs are rejected", async () => {
  let n = 0;
  await assert.rejects(
    analyze(pages, { target: 4 }, async () =>
      ++n === 1
        ? JSON.stringify({ cards: [concept] })
        : JSON.stringify({ selectedIds: ["invented"], coverage: "x" }),
    ),
    /invalid study plan/,
  );
});
test("free-only model gate checks all prices and requires a free route", () => {
  assert.equal(
    isFree({
      id: "qwen/example:free",
      pricing: { prompt: "0", completion: "0", request: "0" },
    }),
    true,
  );
  assert.equal(
    isFree({ id: "qwen/example", pricing: { prompt: "0", completion: "0" } }),
    false,
  );
  assert.equal(
    isFree({
      id: "qwen/example:free",
      pricing: { prompt: "0", completion: "0", request: "1" },
    }),
    false,
  );
});
test("model listing excludes paid and short-context endpoints", async () => {
  const m = await getModels(async () => ({
    ok: true,
    json: async () => ({
      data: [
        {
          id: "qwen/example:free",
          name: "Qwen",
          pricing: { prompt: "0", completion: "0" },
          context_length: 64000,
        },
        { id: "paid/model", pricing: { prompt: "1" }, context_length: 100000 },
      ],
    }),
  }));
  assert.equal(m.length, 1);
  assert.match(m[0].id, /qwen/);
});
test("long document batching retains every page and imposes an explicit request cap", () => {
  const chunks = batches(
    Array.from({ length: 10 }, (_, i) => ({
      ...pages[0],
      page: i + 1,
      text: "x".repeat(12000),
    })),
  );
  assert.equal(chunks.length, 10);
  assert.throws(
    () => batches([{ ...pages[0], text: "x".repeat(600000) }]),
    /30 AI reading batches/,
  );
});
test("cancellation stops before inference", async () => {
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    analyze(
      pages,
      { target: 4 },
      async () => {
        throw Error("Must not run");
      },
      () => {},
      c.signal,
    ),
    /aborted/,
  );
});
test("source IDs bind evidence to the original PDF text and reject invented IDs", async () => {
  const damaged = [
    {
      source: "scan.pdf",
      page: 7,
      text: "Mechanics is the phy ical science which deals with forces on objects.",
    },
  ];
  let calls = 0;
  const result = await analyze(damaged, { target: 4 }, async (_s, prompt) => {
    if (++calls === 1) {
      const excerpt = JSON.parse(prompt.split("SOURCE EXCERPTS:\n")[1])[0];
      return JSON.stringify({
        cards: [
          {
            ...concept,
            evidenceId: excerpt.evidenceId,
            evidence: "rewritten quote",
            pageIndex: 999,
          },
          { ...concept, evidenceId: "invented" },
        ],
      });
    }
    const id = JSON.parse(prompt.slice(prompt.indexOf("[{")))[0].id;
    return JSON.stringify({ selectedIds: [id], coverage: "Mechanics" });
  });
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].evidence, damaged[0].text);
  assert.equal(result.cards[0].page, 7);
  assert.equal(result.rejected, 1);
});
