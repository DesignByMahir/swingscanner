const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");

if (process.env.SWINGSCANNER_REMOTE_DEBUGGING_PORT) {
  app.commandLine.appendSwitch(
    "remote-debugging-port",
    process.env.SWINGSCANNER_REMOTE_DEBUGGING_PORT,
  );
}

let mainWindow;
let serverProcess;
let serverUrl;
let updateState = {
  status: app.isPackaged ? "idle" : "desktop-only",
  message: app.isPackaged ? "Check for updates" : "Desktop updates only",
  progress: null,
  version: null,
  releaseNotes: null,
};

function openExternalBrowser(target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return;

  const isTradingView = /(^|\.)tradingview\.com$/i.test(parsed.hostname);
  if (process.platform === "win32" && isTradingView) {
    const edgeCandidates = [
      path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(process.env.PROGRAMFILES ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    ];
    const edge = edgeCandidates.find((candidate) => candidate && fs.existsSync(candidate));
    if (edge) {
      const browser = spawn(edge, ["--new-tab", parsed.toString()], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      browser.unref();
      return;
    }
  }

  void shell.openExternal(parsed.toString());
}

function sendUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  mainWindow?.webContents.send("updates:state", updateState);
  return updateState;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => port ? resolve(port) : reject(new Error("Unable to allocate a local port.")));
    });
  });
}

function waitForServer(url, attempts = 160) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(`${url}/api/health`, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry();
      });
      request.on("error", retry);
    };
    const retry = () => {
      if (attempts-- <= 0) reject(new Error("SwingScanner local server did not start."));
      else setTimeout(check, 250);
    };
    check();
  });
}

async function startProductionServer() {
  const port = await findFreePort();
  const serverRoot = path.join(process.resourcesPath, "app-server");
  const serverEntry = path.join(serverRoot, "server.js");
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "data");
  const cacheDir = path.join(userData, "cache");
  const logsDir = path.join(userData, "logs");

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  const output = fs.openSync(path.join(logsDir, "server.log"), "a");
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverRoot,
    windowsHide: true,
    stdio: ["ignore", output, output],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_PATH: path.join(serverRoot, "modules"),
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      SWINGSCANNER_DATA_DIR: dataDir,
      SWINGSCANNER_CACHE_DIR: cacheDir,
    },
  });
  serverProcess.once("exit", (code) => {
    if (code && !app.isQuitting) sendUpdateState({ status: "error", message: "Local app server stopped unexpectedly" });
  });

  serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(serverUrl);
  return serverUrl;
}

function configureUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => sendUpdateState({ status: "checking", message: "Checking..." }));
  autoUpdater.on("update-available", (info) => sendUpdateState({
    status: "available",
    message: "Update available",
    version: info.version,
    releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : null,
  }));
  autoUpdater.on("update-not-available", () => sendUpdateState({ status: "current", message: "You're up to date", progress: null }));
  autoUpdater.on("download-progress", (progress) => sendUpdateState({
    status: "downloading",
    message: "Downloading update...",
    progress: Math.round(progress.percent),
  }));
  autoUpdater.on("update-downloaded", (info) => sendUpdateState({
    status: "downloaded",
    message: "Restart to update",
    progress: 100,
    version: info.version,
  }));
  autoUpdater.on("error", (error) => sendUpdateState({
    status: "error",
    message: "Update check failed",
    error: error?.message ?? String(error),
  }));
}

async function checkForUpdates() {
  if (!app.isPackaged) return sendUpdateState({ status: "desktop-only", message: "Desktop updates only" });
  try {
    sendUpdateState({ status: "checking", message: "Checking...", progress: null });
    await autoUpdater.checkForUpdates();
  } catch (error) {
    sendUpdateState({ status: "error", message: "Update check failed", error: error?.message ?? String(error) });
  }
  return updateState;
}

async function createWindow() {
  const url = app.isPackaged
    ? await startProductionServer()
    : process.env.SWINGSCANNER_DESKTOP_DEV_URL ?? "http://127.0.0.1:3000";

  mainWindow = new BrowserWindow({
    title: "SwingScanner",
    width: 1500,
    height: 960,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#090b0d",
    icon: path.join(__dirname, "assets", "generated", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    openExternalBrowser(target);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!serverUrl || target.startsWith(serverUrl)) return;
    event.preventDefault();
    openExternalBrowser(target);
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  await mainWindow.loadURL(`${url}/scanner`);
}

app.setName("SwingScanner");
app.setAppUserModelId("com.swingscanner.desktop");
app.on("before-quit", () => { app.isQuitting = true; });
app.whenReady().then(async () => {
  configureUpdater();
  ipcMain.handle("updates:get-state", () => updateState);
  ipcMain.handle("updates:check", checkForUpdates);
  ipcMain.handle("updates:install", () => {
    if (updateState.status !== "downloaded") return updateState;
    autoUpdater.quitAndInstall(false, true);
    return updateState;
  });
  await createWindow();
  if (app.isPackaged) setTimeout(() => void checkForUpdates(), 15_000);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
