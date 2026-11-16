import type { Card } from "./core";
export type Landmark = {
  x: number;
  z: number;
  rotation: number;
  asset: string;
  name: string;
  zone: string;
  size: number;
  elevation: number;
};
export type Layout = { version: 2; seed: string; landmarks: Landmark[] };
const props = [
  ["ArmChair_01", "Reading chair", "study", 1.65, 0],
  ["wooden_table_02", "Oak table", "process", 2, 0],
  ["Sofa_01", "Velvet sofa", "general", 2.8, 0],
  ["CoffeeTable_01", "Coffee table", "general", 1.6, 0],
  ["ClassicConsole_01", "Carved console", "history", 2, 0],
  ["ClassicNightstand_01", "Bedside cabinet", "general", 1.3, 0],
  ["Rockingchair_01", "Rocking chair", "process", 1.7, 0],
  ["SchoolDesk_01", "Writing desk", "study", 1.8, 0],
  ["chess_set", "Chess board", "comparison", 1.1, 0.85],
  ["mantel_clock_01", "Mantel clock", "time", 0.9, 0.85],
  ["Lantern_01", "Brass lantern", "energy", 0.75, 0.85],
  ["Ukulele_01", "Ukulele", "sound", 1.1, 0.75],
  ["Camera_01", "Film camera", "observation", 0.65, 0.85],
  ["antique_ceramic_vase_01", "Ceramic vase", "structure", 1.15, 0.55],
  ["Ottoman_01", "Leather ottoman", "general", 1.45, 0],
  ["wooden_bookshelf_worn", "Bookcase", "study", 2.5, 0],
] as const;
export function randomFrom(seed: string) {
  let s = 2166136261;
  for (const c of seed) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createLayout(
  seed: string,
  cards: Card[],
  environment: "house" | "carnival",
): Layout {
  const rng = randomFrom(seed);
  const available = [...props.keys()];
  // A broad central crossing and fixed doors remain clear. Jitter stays inside furnished bays.
  const bays = [
    [-9, -12],
    [-5, -12],
    [-9, -5],
    [-5, -5],
    [5, -12],
    [9, -12],
    [5, -5],
    [9, -5],
    [-9, 5],
    [-5, 5],
    [-9, 12],
    [-5, 12],
    [5, 5],
    [9, 5],
    [5, 12],
    [9, 12],
  ];
  const zones =
    environment === "house"
      ? [
          "The jade library",
          "The amber study",
          "The blue salon",
          "The terracotta gallery",
        ]
      : [
          "The clockmaker’s arcade",
          "The botanical market",
          "The lantern court",
          "The music pavilion",
        ];
  const landmarks = cards.slice(0, 16).map((card, i) => {
    const desired = card.category || "general";
    const matches = available.filter((n) => props[n][2] === desired);
    const candidates = matches.length ? matches : available;
    const index = candidates[Math.floor(rng() * candidates.length)];
    available.splice(available.indexOf(index), 1);
    const p = props[index];
    const [x, z] = bays[i];
    return {
      x: x + (rng() - 0.5) * 0.65,
      z: z + (rng() - 0.5) * 0.65,
      rotation: x < 0 ? 0.18 : -0.18,
      asset: p[0],
      name: p[1],
      zone: zones[Math.floor(i / 4)],
      size: p[3],
      elevation: p[4],
    };
  });
  return { version: 2, seed, landmarks };
}
export function validLayout(value: unknown, count: number): value is Layout {
  const l = value as Layout;
  return (
    !!l &&
    l.version === 2 &&
    typeof l.seed === "string" &&
    Array.isArray(l.landmarks) &&
    l.landmarks.length === count &&
    l.landmarks.every(
      (p) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.z) &&
        Math.abs(p.x) < 11 &&
        Math.abs(p.z) < 14 &&
        Number.isFinite(p.rotation) &&
        props.some((v) => v[0] === p.asset) &&
        typeof p.name === "string" &&
        typeof p.zone === "string" &&
        Number.isFinite(p.size) &&
        p.size > 0 &&
        p.size < 4 &&
        Number.isFinite(p.elevation) &&
        p.elevation >= 0 &&
        p.elevation < 2,
    )
  );
}
