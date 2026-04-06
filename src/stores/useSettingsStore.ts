import { create } from "zustand";

import {
  AppSettings,
  loadStoredSettings,
  normalizeSettings,
} from "../lib/settings";
import { decryptApiKey, encryptApiKey } from "../lib/encryption";

interface SettingsState {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = "geoai-settings";

/**
 * Chiffre les clés API avant persistance
 */
function encryptSettingsForStorage(settings: AppSettings): AppSettings {
  return {
    ...settings,
    apiKey: encryptApiKey(settings.apiKey),
    googleApiKey: encryptApiKey(settings.googleApiKey),
    openrouterApiKey: encryptApiKey(settings.openrouterApiKey),
  };
}

/**
 * Déchiffre les clés API après chargement
 */
function decryptSettingsFromStorage(settings: AppSettings): AppSettings {
  return {
    ...settings,
    apiKey: decryptApiKey(settings.apiKey),
    googleApiKey: decryptApiKey(settings.googleApiKey),
    openrouterApiKey: decryptApiKey(settings.openrouterApiKey),
  };
}

function persistSettings(settings: AppSettings): void {
  try {
    const encrypted = encryptSettingsForStorage(settings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
  } catch {
    // silent fail
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: normalizeSettings(decryptSettingsFromStorage(loadStoredSettings())),

  setSettings: (settings) => {
    const normalized = normalizeSettings(settings);
    persistSettings(normalized);
    set({ settings: normalized });
  },

  updateSettings: (partial) =>
    set((state) => {
      const merged = normalizeSettings({ ...state.settings, ...partial });
      persistSettings(merged);
      return { settings: merged };
    }),

  resetSettings: () => {
    const fresh = normalizeSettings(decryptSettingsFromStorage(loadStoredSettings()));
    persistSettings(fresh);
    set({ settings: fresh });
  },
}));
