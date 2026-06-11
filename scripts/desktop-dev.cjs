const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const electron = process.platform === "win32"
  ? path.join(root, "node_modules", ".bin", "electron.cmd")
  : path.join(root, "node_modules", ".bin", "electron");

const next = spawn(npm, ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"], {
  cwd: root,
  stdio: "inherit",
});

let desktop;
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  desktop?.kill();
  next.kill();
  process.exit(code);
}

function waitForServer(attempts = 120) {
  const request = http.get("http://127.0.0.1:3000/api/health", (response) => {
    response.resume();
    if (response.statusCode && response.statusCode < 500) {
      desktop = spawn(electron, ["."], {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, SWINGSCANNER_DESKTOP_DEV_URL: "http://127.0.0.1:3000" },
      });
      desktop.on("exit", (code) => stop(code ?? 0));
      return;
    }
    retry(attempts);
  });
  request.on("error", () => retry(attempts));
}

function retry(attempts) {
  if (attempts <= 0) stop(1);
  else setTimeout(() => waitForServer(attempts - 1), 500);
}

next.on("exit", (code) => stop(code ?? 1));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
waitForServer();
