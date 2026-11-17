const { app, BrowserWindow, ipcMain, Menu, net, protocol, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { autoUpdater } = require("electron-updater");
const library = require("./database.cjs");

Menu.setApplicationMenu(null);

protocol.registerSchemesAsPrivileged([{
  scheme: "simple-docs",
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);

let mainWindow = null;
const rendererPath = path.join(__dirname, "..", "out");

function registerAppProtocol() {
  protocol.handle("simple-docs", (request) => {
    const requestUrl = new URL(request.url);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === "/") pathname = "/index.html";
    else if (pathname.endsWith("/")) pathname += "index.html";
    const requestedPath = path.resolve(rendererPath, "." + pathname);
    const relativePath = path.relative(rendererPath, requestedPath);
    const safe = relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
    return safe ? net.fetch(pathToFileURL(requestedPath).toString()) : new Response("Not found", { status: 404 });
  });
}

function registerIpc() {
  ipcMain.handle("library:list", (_event, options) => library.listNotes(options ?? {}));
  ipcMain.handle("library:open", (_event, id) => {
    const item = library.touchNote(id);
    if (!item) throw new Error("This Library item no longer exists.");
    return item;
  });
  ipcMain.handle("library:save", (_event, input) => library.saveNote(input));
  ipcMain.handle("library:delete", (_event, id) => library.deleteNote(id));
  ipcMain.handle("library:favorite", (_event, id, favorite) => {
    const item = library.setFavorite(id, favorite);
    if (!item) throw new Error("This Library item no longer exists.");
    return item;
  });
  ipcMain.handle("library:folders:list", () => library.listFolders());
  ipcMain.handle("library:folders:create", (_event, name, parentId) => library.createFolder(name, parentId ?? null));
  ipcMain.handle("library:folders:rename", (_event, id, name) => library.renameFolder(id, name));
  ipcMain.handle("library:folders:delete", (_event, id) => library.deleteFolder(id));
  ipcMain.handle("shell:openExternal", async (_event, url) => {
    if (typeof url !== "string") throw new Error("Invalid URL.");
    const parsed = new URL(url);
    if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) throw new Error("Unsupported URL protocol.");
    await shell.openExternal(url);
    return { ok: true };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#090b0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.maximize();
  if (process.platform === "win32" || process.platform === "linux") mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.loadURL(app.isPackaged ? "simple-docs://app/" : "http://localhost:3000");
}

app.whenReady().then(() => {
  library.initializeDatabase(app.getPath("userData"));
  registerIpc();
  if (app.isPackaged) registerAppProtocol();
  createWindow();
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    void autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
});

app.on("before-quit", () => library.closeDatabase());
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
