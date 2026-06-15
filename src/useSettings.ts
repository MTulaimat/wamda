import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, saveSettings } from "./ipc";
import { applyAccent } from "./accent";
import {
  DEFAULT_SETTINGS,
  type ProviderId,
  type Providers,
  type Settings,
} from "./types";

/**
 * Load settings on mount and persist on change (debounced). Each window mounts
 * its own copy; persistence is the single source of truth, so they converge on
 * next open. Accent is applied live on every change.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (!alive) return;
        setSettings(s);
        applyAccent(s.accent);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const scheduleSave = useCallback((next: Settings) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveSettings(next);
    }, 250);
  }, []);

  /** Merge a top-level partial update, apply accent live, and persist (debounced). */
  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        if (patch.accent) applyAccent(next.accent);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  /**
   * Merge a patch into one provider's nested config. `update`'s shallow merge
   * would clobber the sibling provider, so nested edits must spread the whole
   * `providers` object — this helper does that safely.
   */
  const updateProvider = useCallback(
    <K extends ProviderId>(id: K, patch: Partial<Providers[K]>) => {
      setSettings((prev) => {
        const next: Settings = {
          ...prev,
          providers: {
            ...prev.providers,
            [id]: { ...prev.providers[id], ...patch },
          },
        };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  /** Persist immediately (e.g. before a window closes / on a discrete action). */
  const flush = useCallback((next: Settings) => {
    window.clearTimeout(saveTimer.current);
    return saveSettings(next);
  }, []);

  return { settings, setSettings, update, updateProvider, flush, loaded };
}
