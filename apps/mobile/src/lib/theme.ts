// Theme Configuration
// Provides colors and styles for light and dark mode

import { useSettingsStore } from './store';

export interface Theme {
  colors: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    accent: string;

    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;

    text: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;

    border: string;
    borderLight: string;

    success: string;
    warning: string;
    error: string;
    info: string;

    // Semantic colors
    card: string;
    cardBorder: string;
    input: string;
    inputBorder: string;
    inputPlaceholder: string;

    // Status colors
    energyHigh: string;
    energyModerate: string;
    energyLow: string;

    glycogenFull: string;
    glycogenModerate: string;
    glycogenLow: string;

    insulinHigh: string;
    insulinModerate: string;
    insulinLow: string;

    recoveryExcellent: string;
    recoveryGood: string;
    recoveryModerate: string;
    recoveryPoor: string;

    fatigueLow: string;
    fatigueModerate: string;
    fatigueHigh: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  fontWeight: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
    extrabold: string;
  };
  shadows: {
    sm: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    md: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    lg: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
}

// Light Theme
const lightTheme: Theme = {
  colors: {
    primary: '#6366f1',
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',
    secondary: '#8b5cf6',
    accent: '#ec4899',

    background: '#f9fafb',
    backgroundSecondary: '#ffffff',
    backgroundTertiary: '#f3f4f6',

    text: '#1f2937',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    textInverse: '#ffffff',

    border: '#e5e7eb',
    borderLight: '#f3f4f6',

    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',

    card: '#ffffff',
    cardBorder: '#e5e7eb',
    input: '#ffffff',
    inputBorder: '#d1d5db',
    inputPlaceholder: '#9ca3af',

    // Status colors
    energyHigh: '#10b981',
    energyModerate: '#f59e0b',
    energyLow: '#ef4444',

    glycogenFull: '#10b981',
    glycogenModerate: '#f59e0b',
    glycogenLow: '#ef4444',

    insulinHigh: '#8b5cf6',
    insulinModerate: '#f59e0b',
    insulinLow: '#3b82f6',

    recoveryExcellent: '#10b981',
    recoveryGood: '#34d399',
    recoveryModerate: '#f59e0b',
    recoveryPoor: '#ef4444',

    fatigueLow: '#10b981',
    fatigueModerate: '#f59e0b',
    fatigueHigh: '#ef4444',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};

// Dark Theme
const darkTheme: Theme = {
  colors: {
    primary: '#818cf8',
    primaryLight: '#a5b4fc',
    primaryDark: '#6366f1',
    secondary: '#a78bfa',
    accent: '#f472b6',

    background: '#111827',
    backgroundSecondary: '#1f2937',
    backgroundTertiary: '#374151',

    text: '#f9fafb',
    textSecondary: '#d1d5db',
    textTertiary: '#9ca3af',
    textInverse: '#1f2937',

    border: '#374151',
    borderLight: '#4b5563',

    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',

    card: '#1f2937',
    cardBorder: '#374151',
    input: '#374151',
    inputBorder: '#4b5563',
    inputPlaceholder: '#9ca3af',

    // Status colors - slightly adjusted for dark mode
    energyHigh: '#34d399',
    energyModerate: '#fbbf24',
    energyLow: '#f87171',

    glycogenFull: '#34d399',
    glycogenModerate: '#fbbf24',
    glycogenLow: '#f87171',

    insulinHigh: '#a78bfa',
    insulinModerate: '#fbbf24',
    insulinLow: '#60a5fa',

    recoveryExcellent: '#34d399',
    recoveryGood: '#6ee7b7',
    recoveryModerate: '#fbbf24',
    recoveryPoor: '#f87171',

    fatigueLow: '#34d399',
    fatigueModerate: '#fbbf24',
    fatigueHigh: '#f87171',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};

/**
 * Hook to use the current theme
 */
export function useTheme(): Theme {
  const darkMode = useSettingsStore((state) => state.darkMode);
  return darkMode ? darkTheme : lightTheme;
}

/**
 * Hook to use theme colors
 */
export function useThemeColors() {
  return useTheme().colors;
}

/**
 * Get current theme
 */
export function getTheme(darkMode: boolean): Theme {
  return darkMode ? darkTheme : lightTheme;
}

// Export themes
export { lightTheme, darkTheme };

// Helper function to get color for a level
export function getLevelColor(level: string, darkMode = false): string {
  const theme = getTheme(darkMode);

  switch (level) {
    case 'VERY_HIGH':
    case 'FULL':
    case 'EXCELLENT':
    case 'VERY_LOW': // For fatigue, very low is good
      return theme.colors.success;
    case 'HIGH':
    case 'GOOD':
    case 'LOW': // For fatigue, low is good
      return darkMode ? theme.colors.energyHigh : theme.colors.primary;
    case 'MODERATE':
      return theme.colors.warning;
    case 'LOW':
    case 'DEPLETED':
    case 'POOR':
      return theme.colors.error;
    case 'VERY_LOW':
    case 'VERY_POOR':
      return theme.colors.error;
    default:
      return theme.colors.textSecondary;
  }
}

// Helper to get metric status (good, warning, error)
export function getMetricStatus(
  value: number,
  thresholds: { good: number; warning: number },
  invert = false
): 'good' | 'warning' | 'error' {
  if (invert) {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'error';
  }
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.warning) return 'warning';
  return 'error';
}
