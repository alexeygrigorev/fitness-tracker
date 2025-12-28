import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

// ============================================
// Types
// ============================================

export interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartConfig {
  width: number;
  height: number;
  padding?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  color?: string;
}

// ============================================
// Line Chart
// ============================================

export interface LineChartProps {
  data: DataPoint[];
  config?: Partial<ChartConfig>;
  style?: any;
}

export const LineChart: React.FC<LineChartProps> = ({ data, config = {}, style }) => {
  const screenWidth = Dimensions.get('window').width;
  const defaultConfig: ChartConfig = {
    width: screenWidth - 64, // padding
    height: 200,
    padding: 20,
    showGrid: true,
    showLabels: true,
    color: '#6366f1',
  };

  const finalConfig = { ...defaultConfig, ...config };
  const { width, height, padding, showGrid, showLabels, color } = finalConfig;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Find min/max values
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  // Calculate points
  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return { x, y, value: point.value, label: point.label, color: point.color };
  });

  // Create path data
  const pathData = points
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `L ${point.x} ${point.y}`;
    })
    .join(' ');

  // Create area path (for fill)
  const areaPath = `${pathData} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`;

  // Grid lines
  const gridLines = showGrid
    ? [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding + chartHeight * ratio;
        const value = maxValue - valueRange * ratio;
        return (
          <G key={`grid-${ratio}`}>
            <Line
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {showLabels && (
              <SvgText
                x={padding - 5}
                y={y + 4}
                fontSize={10}
                fill="#9ca3af"
                textAnchor="end"
              >
                {value.toFixed(0)}
              </SvgText>
            )}
          </G>
        );
      })
    : null;

  // X-axis labels
  const xLabels = showLabels
    ? points.map((point, index) => (
        <SvgText
          key={`label-${index}`}
          x={point.x}
          y={height - 5}
          fontSize={10}
          fill="#9ca3af"
          textAnchor="middle"
        >
          {point.label}
        </SvgText>
      ))
    : null;

  // Data points
  const dataPoints = points.map((point, index) => (
    <Circle
      key={`point-${index}`}
      cx={point.x}
      cy={point.y}
      r={4}
      fill={point.color || color}
      stroke="#fff"
      strokeWidth={2}
    />
  ));

  return (
    <View style={[styles.container, style]}>
      <Svg width={width} height={height}>
        {gridLines}
        <Path d={areaPath} fill={`${color}20`} />
        <Path d={pathData} fill="none" stroke={color} strokeWidth={2} />
        {dataPoints}
        {xLabels}
      </Svg>
    </View>
  );
};

// ============================================
// Bar Chart
// ============================================

export interface BarChartProps {
  data: DataPoint[];
  config?: Partial<ChartConfig>;
  style?: any;
}

export const BarChart: React.FC<BarChartProps> = ({ data, config = {}, style }) => {
  const screenWidth = Dimensions.get('window').width;
  const defaultConfig: ChartConfig = {
    width: screenWidth - 64,
    height: 200,
    padding: 20,
    showGrid: false,
    showLabels: true,
    color: '#6366f1',
  };

  const finalConfig = { ...defaultConfig, ...config };
  const { width, height, padding, showLabels, color } = finalConfig;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Find max value
  const maxValue = Math.max(...data.map((d) => d.value)) || 1;

  // Bar calculations
  const barWidth = chartWidth / data.length * 0.6;
  const gap = chartWidth / data.length * 0.4;

  const bars = data.map((point, index) => {
    const barHeight = (point.value / maxValue) * chartHeight;
    const x = padding + index * (barWidth + gap) + gap / 2;
    const y = padding + chartHeight - barHeight;

    return (
      <G key={`bar-${index}`}>
        <Rect
          x={x}
          y={y}
          width={barWidth}
          height={barHeight}
          fill={point.color || color}
          rx={4}
        />
        {showLabels && point.value > 0 && (
          <SvgText
            x={x + barWidth / 2}
            y={y - 5}
            fontSize={10}
            fill="#6b7280"
            textAnchor="middle"
          >
            {point.value}
          </SvgText>
        )}
        {showLabels && (
          <SvgText
            x={x + barWidth / 2}
            y={height - 5}
            fontSize={10}
            fill="#9ca3af"
            textAnchor="middle"
          >
            {point.label}
          </SvgText>
        )}
      </G>
    );
  });

  return (
    <View style={[styles.container, style]}>
      <Svg width={width} height={height}>{bars}</Svg>
    </View>
  );
};

// ============================================
// Donut Chart
// ============================================

export interface DonutChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  config?: { size?: number; strokeWidth?: number; showLabels?: boolean };
  style?: any;
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, config = {}, style }) => {
  const defaultConfig = {
    size: 160,
    strokeWidth: 30,
    showLabels: true,
  };

  const finalConfig = { ...defaultConfig, ...config };
  const { size, strokeWidth, showLabels } = finalConfig;

  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentOffset = 0;

  const segments = data.map((item, index) => {
    const percentage = item.value / total;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    const rotation = -90; // Start from top

    currentOffset += percentage * circumference;

    return (
      <Circle
        key={index}
        cx={center}
        cy={center}
        r={radius}
        stroke={item.color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        rotation={rotation}
        origin={`${center}, ${center}`}
      />
    );
  });

  // Center label (total value)
  const centerLabel = showLabels ? (
    <>
      <SvgText
        x={center}
        y={center - 5}
        fontSize={24}
        fontWeight="bold"
        fill="#1f2937"
        textAnchor="middle"
      >
        {total}
      </SvgText>
      <SvgText
        x={center}
        y={center + 15}
        fontSize={12}
        fill="#9ca3af"
        textAnchor="middle"
      >
        Total
      </SvgText>
    </>
  ) : null;

  // Legend
  const legend = showLabels ? (
    <G transform={`translate(${size + 10}, 20)`}>
      {data.map((item, index) => (
        <G key={`legend-${index}`} y={index * 20}>
          <Rect width={12} height={12} fill={item.color} rx={2} />
          <SvgText x={18} y={10} fontSize={11} fill="#6b7280">
            {item.label}
          </SvgText>
        </G>
      ))}
    </G>
  ) : null;

  return (
    <View style={[styles.container, style]}>
      <Svg width={size + (showLabels ? 100 : 0)} height={size}>
        {segments}
        {centerLabel}
        {legend}
      </Svg>
    </View>
  );
};

// ============================================
// Progress Ring
// ============================================

export interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showLabel?: boolean;
  label?: string;
  style?: any;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 12,
  color = '#6366f1',
  backgroundColor = '#e5e7eb',
  showLabel = true,
  label,
  style,
}) => {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(progress / 100) * circumference} ${circumference}`;

  // Determine color based on progress
  const getColor = () => {
    if (progress >= 80) return '#10b981';
    if (progress >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const progressColor = color || getColor();

  const centerLabelContent = showLabel ? (
    <>
      <SvgText
        x={center}
        y={center + (label ? -5 : 5)}
        fontSize={28}
        fontWeight="bold"
        fill="#1f2937"
        textAnchor="middle"
      >
        {Math.round(progress)}%
      </SvgText>
      {label && (
        <SvgText
          x={center}
          y={center + 15}
          fontSize={12}
          fill="#9ca3af"
          textAnchor="middle"
        >
          {label}
        </SvgText>
      )}
    </>
  ) : null;

  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
          fill="none"
        />
        {centerLabelContent}
      </Svg>
    </View>
  );
};

// ============================================
// Weekly Activity Chart (Bar chart with goal line)
// ============================================

export interface WeeklyActivityProps {
  data: Array<{ day: string; value: number; goal?: number }>;
  config?: Partial<ChartConfig>;
  style?: any;
}

export const WeeklyActivityChart: React.FC<WeeklyActivityProps> = ({ data, config = {}, style }) => {
  const screenWidth = Dimensions.get('window').width;
  const defaultConfig: ChartConfig = {
    width: screenWidth - 64,
    height: 180,
    padding: 16,
    showGrid: true,
    showLabels: true,
    color: '#6366f1',
  };

  const finalConfig = { ...defaultConfig, ...config };
  const { width, height, padding, color: _color } = finalConfig;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Find max value
  const maxValue = Math.max(...data.map((d) => Math.max(d.value, d.goal || 0))) || 1;

  // Goal line
  const goalValue = data[0]?.goal || 0;
  const goalY = padding + chartHeight - (goalValue / maxValue) * chartHeight;

  // Bars
  const barWidth = chartWidth / data.length * 0.5;
  const gap = chartWidth / data.length * 0.5;

  const bars = data.map((point, index) => {
    const barHeight = (point.value / maxValue) * chartHeight;
    const x = padding + index * (barWidth + gap) + gap / 2;
    const y = padding + chartHeight - barHeight;

    // Color based on whether goal is met
    const barColor = point.value >= (point.goal || 0) ? '#10b981' : point.value > 0 ? '#f59e0b' : '#e5e7eb';

    return (
      <G key={`bar-${index}`}>
        <Rect x={x} y={y} width={barWidth} height={barHeight} fill={barColor} rx={4} />
        <SvgText
          x={x + barWidth / 2}
          y={height - 5}
          fontSize={10}
          fill="#9ca3af"
          textAnchor="middle"
        >
          {point.day}
        </SvgText>
      </G>
    );
  });

  // Goal line
  const goalLine = goalValue > 0 ? (
    <G>
      <Line
        x1={padding}
        y1={goalY}
        x2={width - padding}
        y2={goalY}
        stroke="#ef4444"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <SvgText x={width - padding + 5} y={goalY + 3} fontSize={10} fill="#ef4444">
        Goal: {goalValue}
      </SvgText>
    </G>
  ) : null;

  return (
    <View style={[styles.container, style]}>
      <Svg width={width} height={height}>
        {bars}
        {goalLine}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});
