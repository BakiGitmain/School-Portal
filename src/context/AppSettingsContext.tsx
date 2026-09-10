import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useColorScheme,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppearanceMode =
  | 'system'
  | 'light'
  | 'dark';

type SettingsState = {
  appearance: AppearanceMode;
  notificationsEnabled: boolean;
  hapticsEnabled: boolean;
  reduceMotion: boolean;
};

export type AppThemeColors = {
  background: string;
  surface: string;
  surfaceSecondary: string;
  card: string;
  border: string;

  text: string;
  textSecondary: string;
  textMuted: string;

  primary: string;
  primarySoft: string;

  danger: string;
  dangerSoft: string;

  success: string;
  successSoft: string;

  input: string;

  overlay: string;

  shadow: string;
};

type AppSettingsContextValue = {
  appearance: AppearanceMode;

  resolvedTheme:
    | 'light'
    | 'dark';

  isDark: boolean;

  colors: AppThemeColors;

  notificationsEnabled: boolean;
  hapticsEnabled: boolean;
  reduceMotion: boolean;

  setAppearance: (
    mode: AppearanceMode
  ) => void;

  setNotificationsEnabled: (
    value: boolean
  ) => void;

  setHapticsEnabled: (
    value: boolean
  ) => void;

  setReduceMotion: (
    value: boolean
  ) => void;
};

const STORAGE_KEY =
  'eduportal.app.settings';

const DEFAULT_SETTINGS: SettingsState = {
  appearance: 'system',
  notificationsEnabled: true,
  hapticsEnabled: true,
  reduceMotion: false,
};

const LIGHT_COLORS: AppThemeColors = {
  background: '#F7FAFE',

  surface: '#FBFDFF',

  surfaceSecondary:
    '#F1F5F9',

  card: '#FFFFFF',

  border: '#E4EBF3',

  text: '#102B59',

  textSecondary:
    '#52657D',

  textMuted: '#8898AC',

  primary: '#1671F5',

  primarySoft: '#EAF3FF',

  danger: '#EF4444',

  dangerSoft: '#FFF0F0',

  success: '#16A34A',

  successSoft: '#ECFDF3',

  input: '#FFFFFF',

  overlay:
    'rgba(15, 23, 42, 0.28)',

  shadow: '#000000',
};

const DARK_COLORS: AppThemeColors = {
  /*
   * Main background.
   *
   * Slightly blue instead of pure black
   * so it matches your header/navbar.
   */
  background: '#0C111B',

  surface: '#101722',

  surfaceSecondary:
    '#182230',

  card: '#141D2A',

  border: '#243248',

  text: '#F4F7FC',

  textSecondary:
    '#C1CCDA',

  textMuted: '#8493A7',

  primary: '#4B9BFF',

  primarySoft: '#142C4A',

  danger: '#FF6868',

  dangerSoft: '#351C23',

  success: '#4ADE80',

  successSoft: '#153223',

  input: '#111A27',

  overlay:
    'rgba(0, 0, 0, 0.58)',

  shadow: '#000000',
};

const AppSettingsContext =
  createContext<
    AppSettingsContextValue | undefined
  >(undefined);

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const systemScheme =
    useColorScheme();

  const [
    settings,
    setSettings,
  ] =
    useState<SettingsState>(
      DEFAULT_SETTINGS
    );

  const [
    loaded,
    setLoaded,
  ] =
    useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    saveSettings();
  }, [
    settings,
    loaded,
  ]);

  async function loadSettings() {
    try {
      const saved =
        await AsyncStorage.getItem(
          STORAGE_KEY
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(
          saved
        ) as Partial<SettingsState>;

      setSettings({
        ...DEFAULT_SETTINGS,
        ...parsed,
      });
    } catch (error) {
      console.log(
        'LOAD SETTINGS ERROR:',
        error
      );
    } finally {
      setLoaded(true);
    }
  }

  async function saveSettings() {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          settings
        )
      );
    } catch (error) {
      console.log(
        'SAVE SETTINGS ERROR:',
        error
      );
    }
  }

  const resolvedTheme:
    | 'light'
    | 'dark' =
    settings.appearance ===
    'system'
      ? systemScheme ===
        'dark'
        ? 'dark'
        : 'light'
      : settings.appearance;

  const isDark =
    resolvedTheme ===
    'dark';

  const colors =
    isDark
      ? DARK_COLORS
      : LIGHT_COLORS;

  const value =
    useMemo<AppSettingsContextValue>(
      () => ({
        appearance:
          settings.appearance,

        resolvedTheme,

        isDark,

        colors,

        notificationsEnabled:
          settings.notificationsEnabled,

        hapticsEnabled:
          settings.hapticsEnabled,

        reduceMotion:
          settings.reduceMotion,

        setAppearance: (
          appearance
        ) => {
          setSettings(
            (current) => ({
              ...current,
              appearance,
            })
          );
        },

        setNotificationsEnabled: (
          value
        ) => {
          setSettings(
            (current) => ({
              ...current,

              notificationsEnabled:
                value,
            })
          );
        },

        setHapticsEnabled: (
          value
        ) => {
          setSettings(
            (current) => ({
              ...current,

              hapticsEnabled:
                value,
            })
          );
        },

        setReduceMotion: (
          value
        ) => {
          setSettings(
            (current) => ({
              ...current,

              reduceMotion:
                value,
            })
          );
        },
      }),

      [
        settings,
        resolvedTheme,
        isDark,
        colors,
      ]
    );

  return (
    <AppSettingsContext.Provider
      value={value}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context =
    useContext(
      AppSettingsContext
    );

  if (!context) {
    throw new Error(
      'useAppSettings must be used inside AppSettingsProvider'
    );
  }

  return context;
}