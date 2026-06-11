"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Binoculars,
  BookOpenText,
  Brain,
  Check,
  ChartLineUp,
  GearSix,
  HardDrives,
  MagnifyingGlass,
  UserCircle,
  SidebarSimple,
  Star,
  TrendUp,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  defaultCommandCenterSettings,
  readCommandCenterSettings,
  writeCommandCenterSettings,
  type CommandCenterSettings,
} from "@/lib/command-center-settings";
import { useSwingAccount } from "@/components/account-provider";
import { RouteMotion } from "@/components/route-motion";

const navItems = [
  { href: "/scanner", label: "Live Scanner", icon: Binoculars },
  { href: "/ticker-research", label: "Ticker Research", icon: MagnifyingGlass },
  { href: "/watchlist", label: "Morning Watchlist", icon: Star },
  { href: "/sectors", label: "Sector Pulse", icon: ChartLineUp },
  { href: "/setup-coach", label: "Setup Coach", icon: Brain },
  { href: "/journal", label: "Trading Journal", icon: BookOpenText },
];

type ViewerTheme = "modern" | "retro" | "flux" | "chroma" | "pastel";
type ChromaColor = "purple" | "orange" | "red" | "green" | "blue";

const chromaColors: Array<{ id: ChromaColor; label: string }> = [
  { id: "purple", label: "Purple" },
  { id: "orange", label: "Orange" },
  { id: "red", label: "Red" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
];

function Brand() {
  return (
    <Link href="/scanner" className="group flex items-center gap-3.5">
      <span className="brand-mark grid size-10 place-items-center rounded-[14px] text-primary">
        <TrendUp size={21} weight="bold" />
      </span>
      <span>
        <span className="block text-[15px] font-semibold tracking-[-0.025em] text-foreground">SwingScanner</span>
        <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.28em] text-muted-foreground">Local market system</span>
      </span>
    </Link>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary navigation" className="space-y-1">
      {navItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "nav-item group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium text-muted-foreground",
              active && "nav-item-active text-foreground",
            )}
          >
            <span className={cn("grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors", active && "text-primary")}>
              <Icon size={17} weight={active ? "duotone" : "regular"} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ViewerTheme>("modern");
  const [chroma, setChroma] = useState<ChromaColor>("purple");
  const [commandCenter, setCommandCenter] = useState<CommandCenterSettings>(defaultCommandCenterSettings);
  const [accountName, setAccountName] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<DesktopUpdateState>({
    status: "desktop-only",
    message: "Desktop updates only",
    progress: null,
    version: null,
    releaseNotes: null,
  });
  const [desktopAvailable, setDesktopAvailable] = useState(false);
  const account = useSwingAccount();

  useEffect(() => {
    const saved = document.documentElement.dataset.theme;
    const current: ViewerTheme = saved === "retro" || saved === "flux" || saved === "chroma" || saved === "pastel" ? saved : "modern";
    const savedChroma = document.documentElement.dataset.chroma;
    const currentChroma: ChromaColor = savedChroma === "orange" || savedChroma === "red" || savedChroma === "green" || savedChroma === "blue" ? savedChroma : "purple";
    const timer = window.setTimeout(() => {
      setTheme(current);
      setChroma(currentChroma);
      setCommandCenter(readCommandCenterSettings());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const desktop = window.swingScannerDesktop;
    if (!desktop) return;
    const unsubscribe = desktop.onUpdateState(setUpdateState);
    const timer = window.setTimeout(() => {
      setDesktopAvailable(true);
      void desktop.getUpdateState().then(setUpdateState);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const selectTheme = (next: ViewerTheme) => {
    document.documentElement.dataset.theme = next;
    localStorage.setItem("swingscanner-theme", next);
    setTheme(next);
  };

  const selectChroma = (next: ChromaColor) => {
    document.documentElement.setAttribute("data-theme", "chroma");
    document.documentElement.setAttribute("data-chroma", next);
    localStorage.setItem("swingscanner-theme", "chroma");
    localStorage.setItem("swingscanner-chroma", next);
    setTheme("chroma");
    setChroma(next);
  };

  const updateCommandCenter = (patch: Partial<CommandCenterSettings>) => {
    const next = { ...commandCenter, ...patch };
    setCommandCenter(next);
    writeCommandCenterSettings(next);
  };

  const handleUpdate = async () => {
    const desktop = window.swingScannerDesktop;
    if (!desktop) return;
    if (updateState.status === "downloaded") setUpdateState(await desktop.restartToUpdate());
    else setUpdateState(await desktop.checkForUpdates());
  };

  return (
    <div className="app-frame min-h-[100dvh] lg:grid lg:grid-cols-[268px_1fr]">
      <div className="app-atmosphere" aria-hidden="true" />
      <aside className="glass-strong fixed inset-y-3 left-3 z-20 hidden w-[244px] rounded-[24px] p-4 lg:flex lg:flex-col">
        <div className="px-2 py-2.5"><Brand /></div>
        <div className="mt-7 flex-1"><Navigation /></div>
        <div className="runtime-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-positive">
            <span className="status-light" />
            <HardDrives size={15} weight="duotone" /> Local runtime
          </div>
          <p className="mt-2.5 text-[11px] leading-5 text-muted-foreground">Market cache, journal data, and Gemma stay on this machine.</p>
          <div className="mt-3 h-px bg-white/[0.06]" />
          <div className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>System</span><span className="text-positive">Ready</span>
          </div>
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="settings-button mt-3 h-10 w-full justify-start rounded-xl px-3 text-xs text-muted-foreground">
              <GearSix size={16} weight="duotone" />
              Settings
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-primary">{theme}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="theme-dialog max-h-[90dvh] overflow-y-auto sm:max-w-[780px] gap-0 p-0">
            <DialogHeader className="border-b p-5 pr-12">
              <DialogTitle className="text-lg">Viewer settings</DialogTitle>
              <DialogDescription>Choose the visual theme. Layout, scan logic, and data stay unchanged.</DialogDescription>
            </DialogHeader>
            <div className="border-b p-5">
              <div className="flex items-center gap-2"><UserCircle className="text-primary" weight="fill" /><p className="text-sm font-semibold">Account sync</p>{account.username && <span className="ml-auto font-mono text-[10px] text-positive">@{account.username}</span>}</div>
              {!account.configured ? (
                <p className="mt-2 text-xs text-muted-foreground">Cloud accounts are not configured. Local journal and scanner data continue to work normally.</p>
              ) : account.userId ? (
                <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Journal, reflections, and flagged setups sync privately across signed-in devices.</p><Button variant="outline" size="sm" onClick={() => account.signOut()}>Sign out</Button></div>
              ) : (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2"><Input placeholder="Username" autoComplete="username" value={accountName} onChange={(event) => setAccountName(event.target.value)} /><Input placeholder="Password" type="password" autoComplete="current-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} /></div>
                  <div className="mt-2 flex gap-2"><Button size="sm" onClick={async () => setAccountMessage(await account.signIn(accountName, accountPassword) ?? "Signed in.")}>Sign in</Button><Button size="sm" variant="outline" onClick={async () => setAccountMessage(await account.register(accountName, accountPassword) ?? "Account registered.")}>Register</Button></div>
                  {accountMessage && <p className="mt-2 text-xs text-muted-foreground">{accountMessage}</p>}
                </>
              )}
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
              <button
                type="button"
                className={cn("theme-choice theme-choice-modern text-left", theme === "modern" && "theme-choice-active")}
                onClick={() => selectTheme("modern")}
              >
                <span className="theme-preview theme-preview-modern" aria-hidden="true">
                  <span /><span /><span />
                </span>
                <span className="mt-3 flex items-center justify-between">
                  <span>
                    <strong className="block text-sm font-semibold">Modern</strong>
                    <span className="mt-1 block text-[11px] text-muted-foreground">Landscape and clear glass</span>
                  </span>
                  {theme === "modern" && <Check className="text-primary" size={18} weight="bold" />}
                </span>
              </button>
              <button
                type="button"
                className={cn("theme-choice theme-choice-retro text-left", theme === "retro" && "theme-choice-active")}
                onClick={() => selectTheme("retro")}
              >
                <span className="theme-preview theme-preview-retro" aria-hidden="true">
                  <span /><span /><span />
                </span>
                <span className="mt-3 flex items-center justify-between">
                  <span>
                    <strong className="block text-sm font-semibold">Retro</strong>
                    <span className="mt-1 block text-[11px] text-muted-foreground">Charcoal grid and terminal green</span>
                  </span>
                  {theme === "retro" && <Check className="text-primary" size={18} weight="bold" />}
                </span>
              </button>
              <button
                type="button"
                className={cn("theme-choice theme-choice-flux text-left", theme === "flux" && "theme-choice-active")}
                onClick={() => selectTheme("flux")}
              >
                <span className="theme-preview theme-preview-flux" aria-hidden="true">
                  <span /><span /><span />
                </span>
                <span className="mt-3 flex items-center justify-between">
                  <span>
                    <strong className="block text-sm font-semibold">Flux</strong>
                    <span className="mt-1 block text-[11px] text-muted-foreground">Fire, water, and black glass</span>
                  </span>
                  {theme === "flux" && <Check className="text-primary" size={18} weight="bold" />}
                </span>
              </button>
              <button
                type="button"
                className={cn("theme-choice theme-choice-chroma text-left", theme === "chroma" && "theme-choice-active")}
                onClick={() => selectTheme("chroma")}
              >
                <span className="theme-preview theme-preview-chroma" aria-hidden="true"><span /><span /><span /></span>
                <span className="mt-3 flex items-center justify-between">
                  <span>
                    <strong className="block text-sm font-semibold">Chroma</strong>
                    <span className="mt-1 block text-[11px] text-muted-foreground">Sculpted single-color forms</span>
                  </span>
                  {theme === "chroma" && <Check className="text-primary" size={18} weight="bold" />}
                </span>
              </button>
              <button
                type="button"
                className={cn("theme-choice theme-choice-pastel text-left", theme === "pastel" && "theme-choice-active")}
                onClick={() => selectTheme("pastel")}
              >
                <span className="theme-preview theme-preview-pastel" aria-hidden="true"><span /><span /><span /></span>
                <span className="mt-3 flex items-center justify-between">
                  <span>
                    <strong className="block text-sm font-semibold">Pastel</strong>
                    <span className="mt-1 block text-[11px] text-muted-foreground">Black with vivid soft color</span>
                  </span>
                  {theme === "pastel" && <Check className="text-primary" size={18} weight="bold" />}
                </span>
              </button>
            </div>
            <div className="border-t p-5">
              <div>
                <p className="text-sm font-semibold">Morning command center</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose which live context appears above the scanner.</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {([
                  ["marketState", "Market state"],
                  ["reminder", "Today’s reminder"],
                  ["news", "Market news"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between rounded-xl border bg-background/35 p-3 text-xs">
                    {label}<Switch checked={commandCenter[key]} onCheckedChange={(checked) => updateCommandCenter({ [key]: checked })} />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-3 rounded-xl border bg-background/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-medium">Reminder history</p><p className="mt-1 text-[10px] text-muted-foreground">Use only the latest trading day or detect repeated recent themes.</p></div>
                <div className="flex rounded-lg border p-1">
                  {(["yesterday", "recent"] as const).map((scope) => <button key={scope} type="button" onClick={() => updateCommandCenter({ reminderScope: scope })} className={cn("rounded-md px-3 py-1.5 text-[10px] capitalize text-muted-foreground", commandCenter.reminderScope === scope && "bg-primary/12 text-primary")}>{scope === "yesterday" ? "Latest day" : "Recent history"}</button>)}
                </div>
              </div>
            </div>
            <div className="border-t p-5">
              <Button
                disabled={!desktopAvailable || updateState.status === "checking" || updateState.status === "downloading"}
                variant="outline"
                className="w-full rounded-full"
                onClick={handleUpdate}
              >
                {updateState.message}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {updateState.status === "downloading" && updateState.progress !== null
                    ? `${updateState.progress}%`
                    : updateState.version
                      ? `v${updateState.version}`
                      : desktopAvailable
                        ? "Desktop updater"
                        : "Desktop updates only"}
                </span>
              </Button>
              {updateState.status === "error" && <p className="mt-2 text-center text-[10px] text-negative">{updateState.error ?? "The update source could not be reached."}</p>}
              {updateState.releaseNotes && <p className="mt-2 line-clamp-3 text-[10px] leading-4 text-muted-foreground">{updateState.releaseNotes}</p>}
            </div>
          </DialogContent>
        </Dialog>
        {theme === "chroma" && (
          <div className="chroma-rail mt-2.5 flex items-center justify-between rounded-xl px-3 py-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">Chroma</span>
            <div className="flex items-center gap-1.5" aria-label="Chroma color">
              {chromaColors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={cn("chroma-swatch", `chroma-swatch-${color.id}`, chroma === color.id && "chroma-swatch-active")}
                  onClick={() => selectChroma(color.id)}
                  aria-label={`Use Chroma ${color.label}`}
                  title={`Chroma ${color.label}`}
                />
              ))}
            </div>
          </div>
        )}
        <p className="mt-4 px-2 text-[9px] leading-4 text-muted-foreground/70">Research and reflection tool only. Not financial advice.</p>
      </aside>
      <div className="relative z-10 min-w-0 lg:col-start-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="glass-mobile-nav fixed left-3 top-3 z-30 lg:hidden" aria-label="Open navigation">
              <SidebarSimple size={21} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[284px] p-5">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Navigate SwingScanner.</SheetDescription>
            <Brand />
            <div className="mt-8"><Navigation onNavigate={() => setMobileOpen(false)} /></div>
          </SheetContent>
        </Sheet>
        <main className="mx-auto w-full max-w-[1680px] p-4 pb-10 pt-16 md:p-6 md:pt-16 lg:p-8 lg:pt-9">
          <RouteMotion>{children}</RouteMotion>
        </main>
      </div>
    </div>
  );
}
