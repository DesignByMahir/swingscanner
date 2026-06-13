const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const log = require("electron-log/main");
const { autoUpdater } = require("electron-updater");

log.initialize();
log.transports.file.level = "info";

if (process.env.SWINGSCANNER_REMOTE_DEBUGGING_PORT) {
  app.commandLine.appendSwitch(
    "remote-debugging-port",
    process.env.SWINGSCANNER_REMOTE_DEBUGGING_PORT,
  );
}

let mainWindow;
let serverProcess;
let serverUrl;
let updateDownloaded = false;
let updateState = {
  status: app.isPackaged ? "idle" : "desktop-only",
  message: app.isPackaged ? "Check & download update" : "Desktop updates only",
  progress: null,
  currentVersion: app.getVersion(),
  latestVersion: null,
  updateDownloaded: false,
  releaseNotes: null,
  platform: process.platform,
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
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => {
    log.info("[updater] checking-for-update", { currentVersion: app.getVersion() });
    sendUpdateState({ status: "checking", message: "Checking for updates...", error: null });
  });
  autoUpdater.on("update-available", (info) => {
    updateDownloaded = false;
    log.info("[updater] update-available", { currentVersion: app.getVersion(), latestVersion: info.version });
    sendUpdateState({
      status: "available",
      message: `Update v${info.version} available`,
      latestVersion: info.version,
      updateDownloaded: false,
      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : null,
    });
  });
  autoUpdater.on("update-not-available", (info) => {
    updateDownloaded = false;
    log.info("[updater] update-not-available", { currentVersion: app.getVersion(), latestVersion: info.version });
    sendUpdateState({
      status: "current",
      message: "You're up to date",
      progress: null,
      latestVersion: info.version,
      updateDownloaded: false,
    });
  });
  autoUpdater.on("download-progress", (progress) => {
    log.info("[updater] download-progress", {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
    sendUpdateState({
      status: "downloading",
      message: "Downloading update...",
      progress: Math.round(progress.percent),
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    updateDownloaded = true;
    log.info("[updater] update-downloaded", { currentVersion: app.getVersion(), latestVersion: info.version });
    sendUpdateState({
      status: "downloaded",
      message: "Restart to update",
      progress: 100,
      latestVersion: info.version,
      updateDownloaded: true,
    });
  });
  autoUpdater.on("before-quit-for-update", () => {
    log.info("[updater] before-quit-for-update", {
      currentVersion: app.getVersion(),
      latestVersion: updateState.latestVersion,
      updateDownloaded,
    });
  });
  autoUpdater.on("error", (error) => {
    log.error("[updater] error", error);
    sendUpdateState({
      status: "error",
      message: "Update check failed",
      error: error?.message ?? String(error),
    });
  });
}

async function checkForUpdates() {
  if (process.platform === "darwin") {
    return sendUpdateState({
      status: "manual-file",
      message: "Choose a SwingScanner update file from Downloads",
      progress: null,
      error: null,
    });
  }
  if (!app.isPackaged) {
    log.info("[updater] skipped update check in development", {
      currentVersion: app.getVersion(),
      forceDevUpdateConfig: autoUpdater.forceDevUpdateConfig,
    });
    return sendUpdateState({ status: "desktop-only", message: "Desktop updates only" });
  }
  try {
    sendUpdateState({ status: "checking", message: "Checking for updates...", progress: null, error: null });
    await autoUpdater.checkForUpdates();
  } catch (error) {
    log.error("[updater] checkForUpdates failed", error);
    sendUpdateState({ status: "error", message: "Update check failed", error: error?.message ?? String(error) });
  }
  return updateState;
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

async function installUpdateFromFile() {
  if (process.platform !== "darwin") {
    return sendUpdateState({
      status: "error",
      message: "File updates are available on macOS only",
      error: "Use Check for updates on Windows.",
    });
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a SwingScanner update",
    defaultPath: app.getPath("downloads"),
    buttonLabel: "Open update",
    properties: ["openFile"],
    filters: [{ name: "SwingScanner Mac update", extensions: ["dmg", "zip"] }],
  });
  if (result.canceled || !result.filePaths[0]) return updateState;

  const updatePath = result.filePaths[0];
  const fileName = path.basename(updatePath);
  const match = /^SwingScanner-(\d+\.\d+\.\d+)-mac-(arm64|x64)\.(dmg|zip)$/i.exec(fileName);
  if (!match) {
    return sendUpdateState({
      status: "error",
      message: "That is not a valid SwingScanner Mac update",
      error: "Choose the original SwingScanner Mac DMG or ZIP file.",
    });
  }

  const [, version, architecture] = match;
  if (compareVersions(version, app.getVersion()) <= 0) {
    return sendUpdateState({
      status: "error",
      message: `SwingScanner v${version} is not newer than v${app.getVersion()}`,
      error: "Choose a newer update file.",
    });
  }
  if (architecture !== process.arch) {
    return sendUpdateState({
      status: "error",
      message: `This Mac needs the ${process.arch} update`,
      error: `The selected file is for ${architecture} Macs.`,
    });
  }

  const openError = await shell.openPath(updatePath);
  if (openError) {
    log.error("[updater] failed to open local update", { updatePath, openError });
    return sendUpdateState({
      status: "error",
      message: "The update file could not be opened",
      error: openError,
    });
  }

  log.info("[updater] opened local update", {
    currentVersion: app.getVersion(),
    selectedVersion: version,
    updatePath,
  });
  return sendUpdateState({
    status: "manual-file-opened",
    message: `SwingScanner v${version} opened. Replace SwingScanner in Applications, then reopen it.`,
    latestVersion: version,
    progress: null,
    error: null,
  });
}

function restartToInstallUpdate() {
  if (!app.isPackaged || !updateDownloaded) {
    log.warn("[updater] restart-to-install-update ignored", {
      packaged: app.isPackaged,
      updateDownloaded,
      status: updateState.status,
    });
    sendUpdateState({
      message: updateDownloaded ? updateState.message : "Update has not finished downloading",
    });
    return;
  }

  log.info("[updater] restart-to-install-update accepted", {
    currentVersion: app.getVersion(),
    latestVersion: updateState.latestVersion,
  });
  autoUpdater.quitAndInstall(false, true);
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
  log.info("[startup] SwingScanner launched", {
    version: app.getVersion(),
    packaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
  });
  if (app.isPackaged) configureUpdater();
  else log.info("[updater] real updater logic disabled for local development");
  ipcMain.handle("updates:get-state", () => updateState);
  ipcMain.handle("updates:check", checkForUpdates);
  ipcMain.handle("updates:install-from-file", installUpdateFromFile);
  ipcMain.on("restart-to-install-update", restartToInstallUpdate);
  await createWindow();
  if (app.isPackaged && process.platform !== "darwin") {
    setTimeout(() => void checkForUpdates(), 15_000);
  }
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
