const fs = require("node:fs");
const path = require("node:path");

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
);
const releaseTag = process.env.GITHUB_REF_NAME;
const refType = process.env.GITHUB_REF_TYPE;

if (!releaseTag || refType !== "tag") {
  console.log(`[release] package version is ${packageJson.version}`);
  process.exit(0);
}

const expectedTag = `v${packageJson.version}`;
if (releaseTag !== expectedTag) {
  throw new Error(
    `[release] tag ${releaseTag} does not match package.json version ${packageJson.version}. ` +
      `Bump package.json before creating the release tag ${expectedTag}.`,
  );
}

console.log(`[release] version check passed: ${releaseTag}`);
