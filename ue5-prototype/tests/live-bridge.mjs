import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const project = fileURLToPath(new URL("../", import.meta.url));
const repo = path.resolve(project, "..");
const pdf = process.argv.find((a) => a.startsWith("--pdf="))?.slice(6);
const live = process.argv.includes("--live");
const token = randomBytes(32).toString("hex");
await fs.mkdir(path.join(project, "Saved"), { recursive: true });
const ready = path.join(project, "Saved", `bridge-test-${Date.now()}.json`);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  path.join(repo, "node_modules/electron/dist/electron.exe"),
  [
    path.join(project, "bridge/main.cjs"),
    `--lab-token=${token}`,
    `--lab-ready=${ready}`,
  ],
  { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let errors = "";
child.stderr.on("data", (b) => {
  errors += b.toString();
});
try {
  let port;
  for (let i = 0; i < 60; i++) {
    try {
      port = JSON.parse(await fs.readFile(ready, "utf8")).port;
      break;
    } catch {}
    if (child.exitCode !== null) throw Error(errors || "Bridge exited");
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!port) throw Error("Bridge startup timed out");
  const url = `http://127.0.0.1:${port}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const status = await (await fetch(url + "/status", { headers })).json();
  console.log(
    JSON.stringify({
      bridge: "connected",
      configured: status.configured,
      model: status.model,
      live,
    }),
  );
  if (live) {
    if (!pdf) throw Error("--pdf=absolute-path is required for live analysis");
    const start = await fetch(url + "/analyze", {
      method: "POST",
      headers,
      body: JSON.stringify({
        filePath: pdf,
        objective:
          "Identify central mechanics concepts for an eight-location memory palace.",
        consent: true,
      }),
    });
    if (start.status !== 202) throw Error(await start.text());
    let previous = "";
    for (let i = 0; i < 480; i++) {
      const { job } = await (await fetch(url + "/status", { headers })).json();
      if (job.progress !== previous) {
        console.log(job.progress);
        previous = job.progress;
      }
      if (job.state === "failed") throw Error(job.progress);
      if (job.state === "complete") {
        await fs.writeFile(
          path.join(project, "Saved", "StudyCards.json"),
          JSON.stringify(job.result, null, 2),
        );
        console.log(
          JSON.stringify({
            liveBridge: "PASS",
            cards: job.result.cards.length,
            requests: job.result.requests,
            model: job.result.model,
          }),
        );
        break;
      }
      if (i === 479) throw Error("Analysis did not finish in eight minutes");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
} finally {
  child.kill();
  await new Promise((r) =>
    child.exitCode !== null ? r() : child.once("exit", r),
  );
  await fs.rm(ready, { force: true });
  const profile = path.resolve(
    os.tmpdir(),
    `MemoryPalaceUE5Bridge-${child.pid}`,
  );
  if (path.dirname(profile) === path.resolve(os.tmpdir()))
    await fs.rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 500,
    });
}
