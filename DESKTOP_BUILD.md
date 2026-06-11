# SwingScanner Desktop Build

SwingScanner uses Electron because the existing app requires Next.js server
routes, Node market-data libraries, local filesystem persistence, and optional
local Ollama access. Electron starts the existing standalone Next.js server on
an available localhost port and closes it with the desktop app.

## Requirements

- Node.js 22
- npm
- Windows 10/11 for local Windows packaging
- macOS or the included GitHub Actions workflow for macOS packaging

## Local web development

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:3000/scanner`.

## Desktop development

```powershell
npm run desktop:dev
```

This starts Next.js development mode and opens the Electron window. The
Settings updater pill says `Desktop updates only` because auto-update is only
enabled in packaged production builds.

## Production web build

```powershell
npm run build
```

## Windows installer

```powershell
npm run desktop:win
```

Outputs are written to `desktop-dist`. The primary artifact is:

```text
SwingScanner-1.0.0-win-x64.exe
```

The NSIS installer creates Start Menu and optional desktop shortcuts. Unsigned
local installers can trigger Windows SmartScreen.

## macOS app and DMG

On macOS:

```bash
npm run desktop:mac
```

This creates `.dmg`, `.zip`, and `.app` outputs for Intel and Apple Silicon.
From Windows, push a version tag and let
`.github/workflows/desktop-release.yml` build macOS artifacts on a macOS
runner. Unsigned macOS builds can be blocked by Gatekeeper.

## App icon

The master artwork is:

```text
electron/assets/SwingScannerLogo.png
```

Generate `.ico`, `.icns`, and desktop PNG assets with:

```powershell
npm run icons:desktop
```

Replace the master PNG with another square 1024x1024 image and rerun that
command when changing the brand icon.

## User data

Installed builds store writable data outside the installation directory:

- Windows: `%APPDATA%\SwingScanner\data` and `%APPDATA%\SwingScanner\cache`
- macOS: `~/Library/Application Support/SwingScanner/data` and `cache`

Electron browser settings and the Supabase session are stored in the same
platform application-data directory. Updates do not delete these folders.
The uninstaller is configured not to delete app data.

Web/local development continues to use `.data` and `.cache/swingscanner`.

## Versioning

The desktop version is `version` in `package.json`. Use semantic versioning:

- `1.0.1`: bug fix
- `1.1.0`: feature release
- `2.0.0`: breaking or major release

Before a release:

```powershell
npm version patch --no-git-tag-version
```

Use `minor` or `major` as appropriate. Commit both `package.json` and
`package-lock.json`.

## First GitHub release

1. Push this project to `https://github.com/DesignByMahir/swingscanner`.
2. In repository Actions settings, allow workflows to write repository
   contents.
3. Optionally add repository variables `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` for account sync.
4. Commit the project.
5. Tag the release:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds Windows and macOS artifacts, then attaches the installers,
update metadata, blockmaps, and macOS update ZIPs to the GitHub Release.

No private GitHub token is stored in the repo. GitHub Actions uses its scoped
`GITHUB_TOKEN`. Local publishing can use `GH_TOKEN` in the current shell:

```powershell
$env:GH_TOKEN = "temporary-token"
$env:GH_OWNER = "DesignByMahir"
$env:GH_REPO = "swingscanner"
npm run desktop:publish
```

Never commit that token.

## Sending future updates

1. Make and verify the app changes.
2. Bump `package.json` with `npm version patch`, `minor`, or `major`.
3. Commit and push.
4. Create and push a matching tag such as `v1.0.1`.
5. Wait for the Desktop Release workflow to publish all artifacts.

Installed apps check GitHub Releases 15 seconds after launch. Users can also
open Settings and click `Check for updates`.

## Local AI compatibility policy

SwingScanner releases keep the coach local through Ollama. The app prefers
`OLLAMA_MODEL` when configured, otherwise it automatically selects an installed
Gemma, Llama, Qwen, Mistral, or Phi chat model. Desktop updates must not replace
this local runtime with a paid or remote AI provider without an explicit product
decision.

Updater states are:

- `Checking...`
- `You're up to date`
- `Update available`
- `Downloading update...`
- `Restart to update`
- `Update check failed`

Updates download in the background. `Restart to update` calls
`quitAndInstall` through the safe Electron preload bridge.

## Testing an update

1. Publish and install `1.0.0`.
2. Confirm journal/reflection data exists.
3. Bump to `1.0.1`.
4. Publish tag `v1.0.1`.
5. Start the installed `1.0.0` app.
6. Open Settings and click `Check for updates`.
7. Wait for `Restart to update`, click it, and confirm version `1.0.1`.
8. Confirm journals, reflections, flags, cached scans, settings, and account
   sessions remain present.

Update checks in unpackaged development intentionally return `Desktop updates
only`.

## Signing later

Unsigned local builds work for testing.

For professional Windows distribution, acquire a code-signing certificate and
provide the certificate/password to electron-builder through CI secrets.

For macOS distribution, add an Apple Developer ID Application certificate,
enable hardened runtime, sign the app, and notarize it using Apple credentials
stored only in GitHub Secrets. Do not commit certificates, passwords, API
keys, or notarization credentials.

## Troubleshooting

- **Installer opens with a warning:** expected for an unsigned local build.
- **Update check failed:** confirm the installed build was produced with the
  correct GitHub owner/repository and that the release contains `latest.yml`
  or `latest-mac.yml`, blockmaps, and installers.
- **App opens but server does not load:** inspect
  `%APPDATA%\SwingScanner\logs\server.log` on Windows or the equivalent
  application-support folder on macOS.
- **Port conflict:** Electron allocates an available port automatically.
- **Local Gemma is offline:** start Ollama and ensure the configured model is
  installed. Packaging does not bundle the large Ollama model.
- **Account sync is unavailable:** configure the two public Supabase build
  variables and apply `supabase/migrations/20260611_user_state.sql`.
