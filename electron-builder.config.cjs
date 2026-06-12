const [ownerFromRepository, repoFromRepository] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
const owner = process.env.GH_OWNER || ownerFromRepository || "DesignByMahir";
const repo = process.env.GH_REPO || repoFromRepository || "swingscanner";

module.exports = {
  appId: "com.swingscanner.desktop",
  productName: "SwingScanner",
  copyright: `Copyright © ${new Date().getFullYear()} SwingScanner`,
  directories: {
    output: "desktop-dist",
    buildResources: "electron/assets/generated",
  },
  files: [
    "electron/**/*",
    "package.json",
    "!electron/assets/SwingScannerLogo.png",
  ],
  extraResources: [
    { from: ".desktop-server", to: "app-server" },
  ],
  afterSign: "scripts/notarize.cjs",
  asar: true,
  artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
  publish: [{ provider: "github", owner, repo, releaseType: "release" }],
  win: {
    icon: "electron/assets/generated/icon.ico",
    target: [{ target: "nsis", arch: ["x64"] }],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "SwingScanner",
    deleteAppDataOnUninstall: false,
  },
  mac: {
    icon: "electron/assets/generated/icon.icns",
    category: "public.app-category.finance",
    target: [
      { target: "dmg", arch: ["arm64", "x64"] },
      { target: "zip", arch: ["arm64", "x64"] },
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "electron/entitlements.mac.plist",
    entitlementsInherit: "electron/entitlements.mac.plist",
  },
  dmg: {
    title: "SwingScanner ${version}",
  },
};
