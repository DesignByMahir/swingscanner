const fs = require("node:fs");
const path = require("node:path");
const png2icons = require("png2icons");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "electron", "assets", "SwingScannerLogo.png");
const output = path.join(root, "electron", "assets", "generated");
const image = fs.readFileSync(source);

fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(source, path.join(output, "icon.png"));

const ico = png2icons.createICO(image, png2icons.BILINEAR, 0, false);
const icns = png2icons.createICNS(image, png2icons.BILINEAR, 0);

if (!ico || !icns) throw new Error("Unable to generate desktop icons from SwingScannerLogo.png.");

fs.writeFileSync(path.join(output, "icon.ico"), ico);
fs.writeFileSync(path.join(output, "icon.icns"), icns);
console.log(`Generated desktop icons in ${output}`);
