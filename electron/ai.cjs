const fs = require("node:fs/promises");
const path = require("node:path");
const { analyze, batches } = require("./analysis.cjs");
const BASE = "https://openrouter.ai/api/v1";
const LINKS = {
  keys: "https://openrouter.ai/settings/keys",
  limits: "https://openrouter.ai/docs/api-reference/limits",
  privacy: "https://openrouter.ai/settings/privacy",
  models: "https://openrouter.ai/models?max_price=0",
};
const isFree = (m) =>
  (m.id === "openrouter/free" || m.id.endsWith(":free")) &&
  m.pricing &&
  Object.values(m.pricing).every((v) => Number(v) === 0);
async function getModels(fetcher = fetch) {
  const r = await fetcher(BASE + "/models", {
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw Error(
      "Cannot load the live free-model catalogue. Check your connection.",
    );
  const data = await r.json();
  return data.data
    .filter(isFree)
    .filter((m) => m.context_length >= 64000)
    .map((m) => ({ id: m.id, name: m.name, context: m.context_length }))
    .sort(
      (a, b) =>
        Number(b.id.includes("qwen")) - Number(a.id.includes("qwen")) ||
        a.name.localeCompare(b.name),
    );
}
function installAI({ ipcMain, app, safeStorage, shell }) {
  const configPath = path.join(app.getPath("userData"), "ai-settings.json");
  const jobs = new Map();
  async function read() {
    try {
      return JSON.parse(await fs.readFile(configPath, "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return { model: "openrouter/free" };
      throw Error("AI settings could not be read. Reconfigure your key.");
    }
  }
  async function write(c) {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath + ".tmp", JSON.stringify(c));
    await fs.rename(configPath + ".tmp", configPath);
  }
  function trusted(event) {
    if (!event.senderFrame) throw Error("Untrusted application origin.");
    const u = new URL(event.senderFrame.url);
    if (u.protocol !== "palace:" || u.hostname !== "app")
      throw Error("Untrusted application origin.");
  }
  const handle = (name, fn) =>
    ipcMain.handle("ai:" + name, async (e, ...args) => {
      trusted(e);
      return fn(e, ...args);
    });
  handle("status", async () => {
    const c = await read();
    return { configured: !!c.key, model: c.model };
  });
  handle("models", () => getModels());
  handle("open", (_e, name) => {
    if (!LINKS[name]) throw Error("Unknown help link.");
    return shell.openExternal(LINKS[name]);
  });
  handle("save", async (_e, { key, model }) => {
    if (
      typeof model !== "string" ||
      !(await getModels()).some((m) => m.id === model)
    )
      throw Error("Select a currently free model.");
    const c = await read();
    if (key) {
      if (typeof key !== "string" || key.length < 20 || key.length > 500)
        throw Error("Paste a valid OpenRouter API key.");
      if (!safeStorage.isEncryptionAvailable())
        throw Error("OS key encryption is unavailable. The key was not saved.");
      c.key = safeStorage.encryptString(key.trim()).toString("base64");
    }
    if (!c.key) throw Error("Paste your API key first.");
    c.model = model;
    await write(c);
    return { configured: true, model };
  });
  handle("remove", async () => {
    await write({ model: "openrouter/free" });
    return true;
  });
  async function key() {
    const c = await read();
    if (!c.key) throw Error("Set up your free AI API key first.");
    return {
      key: safeStorage.decryptString(Buffer.from(c.key, "base64")),
      model: c.model,
    };
  }
  handle("test", async () => {
    const c = await key();
    const r = await fetch(BASE + "/key", {
      headers: { Authorization: `Bearer ${c.key}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok)
      throw Error(
        r.status === 401
          ? "The key was rejected. Create a new key and try again."
          : "Could not verify your key. Try again later.",
      );
    const body = await r.json();
    return {
      valid: true,
      remaining: body.data?.free_model_daily_requests?.remaining ?? null,
    };
  });
  handle("cancel", (e) => {
    jobs.get(e.sender.id)?.abort();
    return true;
  });
  handle("estimate", (_e, pages) => ({ requests: batches(pages).length + 1 }));
  handle("analyze", async (e, { pages, objective, target, consent }) => {
    if (consent !== true)
      throw Error(
        "Confirm that document text can be sent to OpenRouter and its model provider.",
      );
    if (jobs.has(e.sender.id)) throw Error("An analysis is already running.");
    const c = await key();
    if (!(await getModels()).some((m) => m.id === c.model))
      throw Error(
        "Your selected model is no longer free or available. Choose another in AI settings.",
      );
    const controller = new AbortController();
    jobs.set(e.sender.id, controller);
    const destroyed = () => controller.abort();
    e.sender.once("destroyed", destroyed);
    const complete = async (system, prompt, signal) => {
      const response = await fetch(BASE + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.key}`,
          "X-Title": "Memory Palace",
        },
        body: JSON.stringify({
          model: c.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 6000,
          provider: { max_price: { prompt: 0, completion: 0 } },
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
      });
      if (!response.ok) {
        if (response.status === 429)
          throw Error(
            "Free-model quota or capacity reached. Wait and retry, or select another free model. No paid fallback was used.",
          );
        if (response.status === 401)
          throw Error("Your API key was rejected. Update it in AI settings.");
        if (response.status === 402)
          throw Error(
            "OpenRouter blocked the request under your account limits. Check your key/account; no paid fallback was used.",
          );
        throw Error(
          `Free-model request failed (${response.status}). Choose another free model or retry later.`,
        );
      }
      const result = await response.json();
      if (
        result.error ||
        typeof result.choices?.[0]?.message?.content !== "string"
      )
        throw Error(
          "The provider returned no usable answer. Try another free model.",
        );
      if (result.choices[0].finish_reason === "length")
        throw Error(
          "Model output was cut short. Request fewer memories or choose another free model.",
        );
      return result.choices[0].message.content;
    };
    try {
      return {
        ...(await analyze(
          pages,
          { objective, target },
          complete,
          (s) => {
            if (!e.sender.isDestroyed()) e.sender.send("ai:progress", s);
          },
          controller.signal,
        )),
        model: c.model,
      };
    } finally {
      jobs.delete(e.sender.id);
      if (!e.sender.isDestroyed())
        e.sender.removeListener("destroyed", destroyed);
    }
  });
}
module.exports = { installAI, getModels, isFree };
