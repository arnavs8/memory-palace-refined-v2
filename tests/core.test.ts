import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCards, grade, validatePalace, shuffled } from "../src/core.ts";
test("extracts uploaded material with provenance and deduplicates passages", () => {
  const pages = [
    {
      text: "Photosynthesis is the process by which plants convert light into chemical energy.\n\nMitochondria are the organelles responsible for cellular respiration.",
      source: "biology.pdf",
      page: 4,
    },
  ];
  const cards = extractCards([...pages, ...pages]);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].title, "Photosynthesis");
  assert.equal(cards[1].page, 4);
  assert.equal(cards[0].source, "biology.pdf");
  assert.deepEqual(
    cards.map((c) => c.anchor),
    [0, 1],
  );
});
test("long notes are not silently discarded", () => {
  const text = Array.from(
    { length: 400 },
    (_, i) =>
      `Unique fact ${i} describes a distinct important scientific principle.`,
  ).join("\n\n");
  assert.equal(extractCards([{ text, source: "notes", page: 1 }]).length, 400);
});
test("grading compares actual locations, including wrong placements and skips", () => {
  const cards = extractCards([
    {
      text: "Alpha is a first concept that requires explanation.\n\nBeta is a second concept with a different explanation.\n\nGamma is another important concept in this chapter.",
      source: "a",
      page: 1,
    },
  ]);
  const answers = { [cards[0].id]: 0, [cards[1].id]: 0, [cards[2].id]: -1 };
  assert.equal(grade(cards, answers).correct, 1);
  assert.equal(grade(cards, answers).missed.length, 2);
  assert.equal(grade(cards, {}).correct, 0);
});
test("shuffling preserves cards without changing stored placements", () => {
  const input = [1, 2, 3, 4, 5];
  assert.deepEqual(shuffled(input).sort(), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});
test("backup validation rejects duplicate or out-of-range placements", () => {
  const cards = extractCards([
    {
      text: "This is a sufficiently long study passage for a valid card.",
      source: "a",
      page: 1,
    },
  ]);
  const palace = {
    id: "p",
    name: "Test",
    environment: "house",
    cards,
    created: "2026-11-16",
    seen: [],
    attempts: [],
  };
  assert.equal(validatePalace(palace).cards.length, 1);
  assert.throws(() =>
    validatePalace({ ...palace, cards: [...cards, ...cards] }),
  );
  assert.throws(() =>
    validatePalace({ ...palace, cards: [{ ...cards[0], anchor: 99 }] }),
  );
  assert.throws(() => validatePalace({ ...palace, environment: "remote" }));
});
