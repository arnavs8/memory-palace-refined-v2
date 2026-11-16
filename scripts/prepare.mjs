import { cp, mkdir, writeFile } from "node:fs/promises";
await mkdir("public/pdf", { recursive: true });
for (const name of ["cmaps", "standard_fonts", "wasm"])
  await cp(`node_modules/pdfjs-dist/${name}`, `public/pdf/${name}`, {
    recursive: true,
  });
await mkdir("public/fonts", { recursive: true });
for (const [family, name] of [
  ["DM+Sans:wght@400;500;600;700", "dm-sans"],
  ["Lora:wght@400;500;600", "lora"],
]) {
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=${family}&display=swap`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    )
  ).text();
  const urls = [...css.matchAll(/url\((https[^)]+)\)/g)];
  const url = urls.at(-1)?.[1];
  if (!url) throw Error(css);
  await writeFile(
    `public/fonts/${name}.woff2`,
    Buffer.from(await (await fetch(url)).arrayBuffer()),
  );
}
