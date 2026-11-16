import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("public/assets");
const headers = {
  "User-Agent": "MemoryPalaceRefined/2.0 (local asset bundler)",
};
async function json(url) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw Error(`${r.status}: ${url}`);
  return r.json();
}
async function download(url, file) {
  try {
    await access(file);
    return;
  } catch {}
  const r = await fetch(url, { headers });
  if (!r.ok) throw Error(`${r.status}: ${url}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
}
const models = [
  "wooden_table_02",
  "ArmChair_01",
  "Sofa_01",
  "CoffeeTable_01",
  "ClassicConsole_01",
  "ClassicNightstand_01",
  "Rockingchair_01",
  "SchoolDesk_01",
  "SchoolChair_01",
  "Barrel_01",
  "Lantern_01",
  "Ukulele_01",
  "Camera_01",
  "Chandelier_01",
  "Ottoman_01",
  "Shelf_01",
];
const catalog = [];
for (const id of models) {
  const files = await json(`https://api.polyhaven.com/files/${id}`);
  const model = files.gltf?.["1k"]?.gltf;
  if (!model) throw Error(`No glTF for ${id}`);
  await download(model.url, path.join(root, "models", id, "model.gltf"));
  for (const [name, item] of Object.entries(model.include || {}))
    await download(item.url, path.join(root, "models", id, name));
  catalog.push({
    id,
    type: "model",
    path: `assets/models/${id}/model.gltf`,
    source: `https://polyhaven.com/a/${id}`,
    license: "CC0-1.0",
  });
  console.log(`Bundled ${id}`);
}
for (const id of [
  "herringbone_parquet",
  "brick_wall_001",
  "concrete_floor_02",
]) {
  const files = await json(`https://api.polyhaven.com/files/${id}`);
  for (const channel of ["diff", "nor_gl", "rough"]) {
    const key = { diff: "Diffuse", nor_gl: "nor_gl", rough: "Rough" }[channel];
    const f = files[key]?.["2k"]?.jpg;
    if (!f) throw Error(`Missing ${id}/${channel}`);
    await download(f.url, path.join(root, "textures", `${id}_${channel}.jpg`));
  }
  catalog.push({
    id,
    type: "texture",
    source: `https://polyhaven.com/a/${id}`,
    license: "CC0-1.0",
  });
  console.log(`Bundled ${id}`);
}
await writeFile(
  path.join(root, "catalog.json"),
  JSON.stringify(catalog, null, 2),
);
