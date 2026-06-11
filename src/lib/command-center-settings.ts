export interface CommandCenterSettings {
  marketState: boolean;
  reminder: boolean;
  news: boolean;
  reminderScope: "yesterday" | "recent";
}

export const defaultCommandCenterSettings: CommandCenterSettings = {
  marketState: true,
  reminder: true,
  news: true,
  reminderScope: "yesterday",
};

export const commandCenterSettingsKey = "swingscanner-command-center";

export function readCommandCenterSettings(): CommandCenterSettings {
  if (typeof window === "undefined") return defaultCommandCenterSettings;
  try {
    return { ...defaultCommandCenterSettings, ...JSON.parse(localStorage.getItem(commandCenterSettingsKey) ?? "{}") };
  } catch {
    return defaultCommandCenterSettings;
  }
}

export function writeCommandCenterSettings(settings: CommandCenterSettings) {
  localStorage.setItem(commandCenterSettingsKey, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("swingscanner-command-center-settings", { detail: settings }));
}
