const http = require("node:http");
const { timingSafeEqual } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

async function readStudyFile(filename) {
  if (typeof filename !== "string" || !path.isAbsolute(filename))
    throw Error("Choose an absolute PDF or text file path.");
  const ext = path.extname(filename).toLowerCase();
  if (![".pdf", ".txt", ".md"].includes(ext))
    throw Error("Only PDF, TXT and Markdown files are supported.");
  const stat = await fs.stat(filename);
  if (!stat.isFile() || stat.size > 50 * 1024 * 1024)
    throw Error("Choose a file smaller than 50 MB.");
  const source = path.basename(filename);
  if (ext !== ".pdf")
    return [{ source, page: 1, text: await fs.readFile(filename, "utf8") }];
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(await fs.readFile(filename)),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  try {
    if (doc.numPages > 1000)
      throw Error("This prototype supports at most 1,000 PDF pages.");
    const pages = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      pages.push({
        source,
        page,
        text: content.items.map((item) => item.str || "").join(" "),
      });
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

function createServer({ token, api, readFile = readStudyFile }) {
  if (typeof token !== "string" || token.length < 32)
    throw Error(
      "A random session token of at least 32 characters is required.",
    );
  let job = { state: "idle", progress: "Ready" };
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const send = (code, body) => {
      res.writeHead(code);
      res.end(JSON.stringify(body));
    };
    const provided = Buffer.from(req.headers.authorization || "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (
      req.headers.origin ||
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    )
      return send(403, { error: "Unauthorized local client." });
    try {
      if (req.method === "GET" && req.url === "/status")
        return send(200, { ...(await api.status()), job });
      if (req.method === "POST" && req.url === "/cancel") {
        await api.cancel();
        return send(200, { cancelled: true });
      }
      if (req.method !== "POST" || req.url !== "/analyze")
        return send(404, { error: "Unknown endpoint." });
      if (job.state === "running")
        return send(409, { error: "Analysis is already running." });
      const parts = [];
      let size = 0;
      for await (const part of req) {
        size += part.length;
        if (size > 16000) return send(413, { error: "Request is too large." });
        parts.push(part);
      }
      const input = JSON.parse(Buffer.concat(parts).toString("utf8"));
      if (job.state === "running")
        return send(409, { error: "Analysis is already running." });
      if (input.consent !== true)
        return send(400, {
          error:
            "Confirm sharing extracted text with OpenRouter before analysis.",
        });
      if (typeof input.objective !== "string" || input.objective.length > 2000)
        return send(400, { error: "Invalid study objective." });
      job = { state: "running", progress: "Reading your material…" };
      const pages = await readFile(input.filePath);
      job.source = path.basename(input.filePath);
      send(202, { started: true });
      api
        .analyze(
          { pages, objective: input.objective, target: 8, consent: true },
          (message) => {
            job.progress = message;
          },
        )
        .then((result) => {
          job = { state: "complete", progress: "Study material ready", result };
        })
        .catch((error) => {
          job = { state: "failed", progress: error.message };
        });
    } catch (error) {
      job = { state: "failed", progress: error.message };
      if (!res.headersSent) send(400, { error: error.message });
    }
  });
  return server;
}
module.exports = { createServer, readStudyFile };
