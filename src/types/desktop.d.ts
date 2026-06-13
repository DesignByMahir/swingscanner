export {};

declare global {
  interface Window {
    swingScannerDesktop?: {
      isDesktop: true;
      getUpdateState: () => Promise<DesktopUpdateState>;
      checkForUpdates: () => Promise<DesktopUpdateState>;
      installUpdateFromFile: () => Promise<DesktopUpdateState>;
      restartToUpdate: () => void;
      onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
    };
  }

  interface DesktopUpdateState {
    status: "idle" | "desktop-only" | "manual-file" | "manual-file-opened" | "checking" | "available" | "current" | "downloading" | "downloaded" | "error";
    message: string;
    progress: number | null;
    currentVersion: string;
    latestVersion: string | null;
    updateDownloaded: boolean;
    releaseNotes: string | null;
    platform: string;
    error?: string | null;
  }
}
