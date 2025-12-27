import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
  variant?: 'elevated' | 'outlined' | 'flat';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  padding = 16,
  variant = 'elevated',
}) => {
  const cardStyle = [
    styles.card,
    styles[variant],
    { padding },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {icon && <View style={styles.headerIcon}>{icon}</View>}
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      {action && <View style={styles.headerAction}>{action}</View>}
    </View>
  );
};

export interface CardMetricProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export const CardMetric: React.FC<CardMetricProps> = ({
  label,
  value,
  unit,
  trend,
  color = '#6366f1',
}) => {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color }]}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Text>
        {unit && <Text style={styles.metricUnit}>{unit}</Text>}
        {trend && (
          <Text style={[styles.metricTrend, trend === 'up' ? styles.trendUp : styles.trendDown]}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  outlined: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  flat: {
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    marginRight: 10,
  },
  headerAction: {
    marginLeft: 'auto',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  metric: {
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  metricUnit: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 2,
  },
  metricTrend: {
    fontSize: 16,
    marginLeft: 6,
  },
  trendUp: {
    color: '#10b981',
  },
  trendDown: {
    color: '#ef4444',
  },
});
