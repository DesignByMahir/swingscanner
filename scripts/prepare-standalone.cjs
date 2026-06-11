const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const desktopServer = path.join(root, ".desktop-server");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Next standalone server was not found. Run `npm run build` first.");
}

function copy(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    dereference: true,
  });
}

copy(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
copy(path.join(root, "public"), path.join(standalone, "public"));

fs.rmSync(desktopServer, { recursive: true, force: true });
fs.mkdirSync(desktopServer, { recursive: true });

for (const entry of fs.readdirSync(standalone, { withFileTypes: true })) {
  if (entry.name === "node_modules") continue;
  copy(path.join(standalone, entry.name), path.join(desktopServer, entry.name));
}

copy(path.join(standalone, "node_modules"), path.join(desktopServer, "modules"));

console.log(`Prepared desktop server at ${desktopServer}`);
