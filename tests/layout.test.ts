import { test } from "node:test";
import assert from "node:assert/strict";
import { createLayout, validLayout } from "../src/layout.ts";
import { validatePalace, type Card } from "../src/core.ts";
const cards: Card[] = Array.from({ length: 16 }, (_, i) => ({
  id: String(i),
  title: "Topic " + i,
  body: "A key concept",
  source: "notes",
  page: 1,
  anchor: i,
  category: i === 0 ? "energy" : "general",
}));
test("layouts are deterministic, category-aware and vary across palaces", () => {
  const a = createLayout("a", cards, "house");
  assert.deepEqual(a, createLayout("a", cards, "house"));
  assert.notDeepEqual(a, createLayout("b", cards, "house"));
  assert.equal(a.landmarks[0].asset, "Lantern_01");
  assert.equal(new Set(a.landmarks.map((p) => p.asset)).size, 16);
});
test("landmarks keep the crossing clear and do not overlap walking collision bounds", () => {
  for (let i = 0; i < 50; i++) {
    const l = createLayout("seed" + i, cards, "house");
    assert.equal(validLayout(l, 16), true);
    for (const a of l.landmarks) {
      assert.ok(Math.abs(a.x) > 4);
      assert.ok(Math.abs(a.z) > 4);
      for (const b of l.landmarks)
        if (a !== b)
          assert.ok(Math.abs(a.x - b.x) > 2.9 || Math.abs(a.z - b.z) > 3.2);
    }
  }
});
test("backups preserve generated placements and reject corrupt layouts", () => {
  const p = {
    id: "a",
    name: "A",
    created: "2026-11-16",
    environment: "house",
    cards,
    seen: [],
    attempts: [],
    layouts: [createLayout("a", cards, "house")],
  };
  assert.deepEqual(validatePalace(p).layouts, p.layouts);
  assert.throws(
    () =>
      validatePalace({ ...p, layouts: [{ ...p.layouts[0], landmarks: [] }] }),
    /layout/,
  );
});
