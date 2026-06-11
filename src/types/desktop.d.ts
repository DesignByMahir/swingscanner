export {};

declare global {
  interface Window {
    swingScannerDesktop?: {
      isDesktop: true;
      getUpdateState: () => Promise<DesktopUpdateState>;
      checkForUpdates: () => Promise<DesktopUpdateState>;
      restartToUpdate: () => Promise<DesktopUpdateState>;
      onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
    };
  }

  interface DesktopUpdateState {
    status: "idle" | "desktop-only" | "checking" | "available" | "current" | "downloading" | "downloaded" | "error";
    message: string;
    progress: number | null;
    version: string | null;
    releaseNotes: string | null;
    error?: string;
  }
}
