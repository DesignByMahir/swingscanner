const path = require("node:path");
const { notarize } = require("@electron/notarize");

module.exports = async function notarizeMacBuild(context) {
  if (context.electronPlatformName !== "darwin") return;

  const required = [
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`[release] macOS notarization credentials missing: ${missing.join(", ")}`);
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[release] notarization started for ${appPath}`);

  await notarize({
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });

  console.log(`[release] notarization completed successfully for ${appPath}`);
};
