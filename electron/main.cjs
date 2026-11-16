const {
  app,
  BrowserWindow,
  protocol,
  net,
  session,
  ipcMain,
  safeStorage,
  shell,
} = require("electron");
const { installAI } = require("./ai.cjs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "palace",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
app.whenReady().then(() => {
  installAI({ ipcMain, app, safeStorage, shell });
  protocol.handle("palace", (request) => {
    const url = new URL(request.url);
    const root = path.resolve(__dirname, "../dist");
    const file = path.resolve(
      root,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (url.host !== "app" || !file.startsWith(root + path.sep))
      return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionRequestHandler(
    (_w, permission, callback) => callback(permission === "pointerLock"),
  );
  function createWindow() {
    const win = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 960,
      minHeight: 700,
      backgroundColor: "#f6f4ef",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, "preload.cjs"),
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("palace://app/")) event.preventDefault();
    });
    win.loadURL("palace://app/");
  }
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
