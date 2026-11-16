export type Card = {
  id: string;
  title: string;
  body: string;
  source: string;
  page: number;
  anchor: number;
};
export type Attempt = {
  date: string;
  correct: number;
  total: number;
  missed: string[];
};
export type Palace = {
  id: string;
  name: string;
  environment: "house" | "carnival";
  created: string;
  cards: Card[];
  seen: string[];
  attempts: Attempt[];
};
export type SourcePage = { text: string; source: string; page: number };
export const PAGE_SIZE = 16;
export const MAX_CARDS = 160;
export function extractCards(pages: SourcePage[]): Card[] {
  const cards: Card[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const clean = page.text
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .trim();
    const paragraphs = clean.split(/\n\s*\n|\n(?=[•\-*]\s)/).filter(Boolean);
    for (const paragraph of paragraphs) {
      const sentences = paragraph
        .replace(/\n/g, " ")
        .match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [paragraph];
      let chunk = "";
      const chunks: string[] = [];
      for (const sentence of sentences) {
        if (chunk.length + sentence.length > 550 && chunk) {
          chunks.push(chunk.trim());
          chunk = "";
        }
        chunk += sentence + " ";
      }
      if (chunk.trim()) chunks.push(chunk.trim());
      for (let body of chunks) {
        body = body.replace(/^[•\-*]\s*/, "").trim();
        if (body.length < 25) continue;
        // Split extremely long passages at word boundaries; never silently truncate source text.
        const pieces = body.match(/.{1,700}(?:\s|$)|\S{1,700}/g) || [body];
        for (const piece of pieces) {
          const normalized = piece.trim();
          const key = normalized.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const definition = normalized.match(
            /^(.{3,75}?)(?:\s+(?:is|are|refers to|means)\s|:\s)/i,
          );
          const title =
            definition?.[1] ||
            normalized
              .split(/\s+/)
              .slice(0, 8)
              .join(" ")
              .replace(/[.,;:]$/, "");
          cards.push({
            id: crypto.randomUUID(),
            title,
            body: normalized,
            source: page.source,
            page: page.page,
            anchor: cards.length,
          });
        }
      }
    }
  }
  return cards;
}
export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function grade(cards: Card[], answers: Record<string, number>) {
  return {
    correct: cards.filter((c) => answers[c.id] === c.anchor).length,
    total: cards.length,
    missed: cards.filter((c) => answers[c.id] !== c.anchor).map((c) => c.id),
  };
}
export function validatePalace(value: unknown): Palace {
  const p = value as Palace;
  if (
    !p ||
    typeof p.id !== "string" ||
    typeof p.name !== "string" ||
    !["house", "carnival"].includes(p.environment) ||
    !Array.isArray(p.cards) ||
    p.cards.length < 1 ||
    p.cards.length > MAX_CARDS
  )
    throw Error("Invalid palace backup.");
  const ids = new Set();
  const anchors = new Set();
  for (const c of p.cards) {
    if (
      !c ||
      typeof c.id !== "string" ||
      typeof c.title !== "string" ||
      !c.title.trim() ||
      c.title.length > 200 ||
      typeof c.body !== "string" ||
      c.body.length > 10000 ||
      typeof c.source !== "string" ||
      !Number.isInteger(c.page) ||
      !Number.isInteger(c.anchor) ||
      c.anchor < 0 ||
      c.anchor >= p.cards.length ||
      ids.has(c.id) ||
      anchors.has(c.anchor)
    )
      throw Error("Invalid study cards in backup.");
    ids.add(c.id);
    anchors.add(c.anchor);
  }
  return {
    id: p.id,
    name: p.name.slice(0, 100),
    environment: p.environment,
    created:
      typeof p.created === "string" ? p.created : new Date().toISOString(),
    cards: p.cards,
    seen: Array.isArray(p.seen) ? p.seen.filter((x) => ids.has(x)) : [],
    attempts: Array.isArray(p.attempts)
      ? p.attempts.filter(
          (a) =>
            a &&
            typeof a.date === "string" &&
            Number.isInteger(a.correct) &&
            Number.isInteger(a.total) &&
            a.correct >= 0 &&
            a.correct <= a.total &&
            Array.isArray(a.missed),
        )
      : [],
  };
}
