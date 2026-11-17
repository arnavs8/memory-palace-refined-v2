// Run with Electron so Windows DPAPI can decrypt the existing app key.
// No API key is sent to Unreal, written to the project or included in arguments.
const { app, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const syncFs = require("node:fs");
const { EventEmitter } = require("node:events");
const { createServer } = require("./server.cjs");
const { installAI } = require("../../electron/ai.cjs");
const args = Object.fromEntries(
  process.argv
    .filter((a) => a.startsWith("--lab-"))
    .map((a) => {
      const i = a.indexOf("=");
      return [a.slice(2, i), a.slice(i + 1)];
    }),
);
if (!args["lab-token"] || !args["lab-ready"]) {
  console.error("Start using Scripts/Run-Lab.ps1.");
  app.exit(1);
}
const profile = path.join(process.env.APPDATA, "Memory Palace");
// Copy only the encrypted settings and DPAPI wrapping key into an isolated
// helper profile, avoiding contention with the running desktop application's cache.
app.disableHardwareAcceleration();
const ownProfile = path.join(
  app.getPath("temp"),
  `MemoryPalaceUE5Bridge-${process.pid}`,
);
syncFs.mkdirSync(ownProfile, { recursive: true });
try {
  for (const name of ["Local State", "ai-settings.json"])
    syncFs.copyFileSync(path.join(profile, name), path.join(ownProfile, name));
} catch {
  console.error(
    "Configure Free AI setup in the Memory Palace desktop app first.",
  );
  app.exit(1);
}
app.setPath("userData", ownProfile);
app.whenReady().then(async () => {
  try {
    // The isolated profile contains only copies of encrypted settings.
    const handlers = {};
    const sender = new EventEmitter();
    sender.id = 1;
    sender.isDestroyed = () => false;
    let progress = () => {};
    sender.send = (_name, message) => progress(message);
    installAI({
      app,
      safeStorage,
      ipcMain: {
        handle: (name, handler) => {
          handlers[name] = handler;
        },
      },
      shell: {},
    });
    const event = { sender, senderFrame: { url: "palace://app/" } };
    const api = {
      status: () => handlers["ai:status"](event),
      cancel: () => handlers["ai:cancel"](event),
      analyze: (input, onProgress) => {
        progress = onProgress;
        return handlers["ai:analyze"](event, input);
      },
    };
    const server = createServer({ token: args["lab-token"], api });
    server.listen(0, "127.0.0.1", async () => {
      await fs.writeFile(
        args["lab-ready"],
        JSON.stringify({ port: server.address().port }),
      );
      console.log(
        "UE5 bridge ready on loopback. API key stays in the helper process.",
      );
    });
    app.on("before-quit", () => {
      api.cancel();
      server.close();
    });
  } catch (e) {
    console.error(e.message);
    app.exit(1);
  }
});
