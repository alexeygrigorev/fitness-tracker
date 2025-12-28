// Theme Provider Component
// Provides theme context to all child components

import React, { createContext, useContext, ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useSettingsStore } from './store';
import type { Theme } from './theme';

// Create context
interface ThemeContextType {
  theme: Theme;
  darkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Hook to use theme
export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if used outside provider
    const darkMode = useSettingsStore((state) => state.darkMode);
    const { lightTheme, darkTheme } = require('./theme');
    return darkMode ? darkTheme : lightTheme;
  }
  return context.theme;
}

// Hook to use theme colors
export function useThemeColors() {
  return useTheme().colors;
}

// Hook to get dark mode state
export function useDarkMode(): boolean {
  const context = useContext(ThemeContext);
  if (!context) {
    return useSettingsStore((state) => state.darkMode);
  }
  return context.darkMode;
}

// Theme Provider Props
interface ThemeProviderProps {
  children: ReactNode;
}

// Theme Provider Component
export function ThemeProvider({ children }: ThemeProviderProps) {
  const darkMode = useSettingsStore((state) => state.darkMode);
  const { lightTheme, darkTheme } = require('./theme');
  const theme = darkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, darkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Helper function to create themed styles
export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  styleFactory: (theme: Theme) => T
): (darkMode: boolean) => T {
  return (darkMode: boolean) => {
    const { lightTheme, darkTheme } = require('./theme');
    const theme = darkMode ? darkTheme : lightTheme;
    return StyleSheet.create(styleFactory(theme));
  };
}
