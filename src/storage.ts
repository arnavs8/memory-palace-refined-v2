import { openDB } from "idb";
import { type Palace, validatePalace } from "./core";
const db = openDB("memory-palace-v2", 1, {
  upgrade(db) {
    db.createObjectStore("palaces", { keyPath: "id" });
  },
});
export async function listPalaces(): Promise<Palace[]> {
  return (await (await db).getAll("palaces"))
    .map(validatePalace)
    .sort((a, b) => b.created.localeCompare(a.created));
}
export async function savePalace(p: Palace) {
  await (await db).put("palaces", validatePalace(p));
}
export async function deletePalace(id: string) {
  await (await db).delete("palaces", id);
}
