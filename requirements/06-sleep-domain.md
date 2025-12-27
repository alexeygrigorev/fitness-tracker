# Sleep Domain

## Purpose

Track sleep patterns, quality, and duration to support recovery modeling, fatigue estimation, and metabolism analysis.

## Sleep Data Sources

### Manual Entry

User can log:
- Bedtime
- Wake time
- Sleep quality rating
- Night awakenings
- Notes

### Device Integration

Imported from Garmin or similar devices:
- Sleep duration
- Sleep stages (deep, light, REM, awake)
- Sleep score/quality
- Resting heart rate during sleep
- Heart rate variability (HRV)

## Sleep Session Entity

### Properties

- Date
- Bedtime timestamp
- Wake time timestamp
- Total duration
- Sleep stages data (if available from device)
- Quality score (manual or device-derived)
- Source:
  - Manual
  - Device
  - Hybrid (edited device data)
- Notes

## Sleep Quality Metrics

### Tracked Metrics

- Total sleep time
- Sleep efficiency (time asleep vs time in bed)
- Sleep stages breakdown (deep, light, REM)
- Sleep consistency (bedtime/wake time regularity)
- Recovery indicators (HRV, resting heart rate)

## Use Cases

### Recovery Modeling

- Sleep quality affects recovery estimation
- Poor sleep may trigger adjusted training or nutrition advice
- Sleep trends inform fatigue modeling

### Metabolism Analysis

- Sleep duration and quality are inputs to metabolic state estimation
- Relates to glycogen status, insulin sensitivity, and energy availability

### Advice Integration

- Poor sleep leading to adjusted training or nutrition recommendations
- Sleep-focused recommendations for improved recovery
- Correlation analysis between sleep and performance

## Retrospective Editing

Users can:
- Add missing sleep sessions
- Adjust bedtime/wake times
- Edit sleep quality ratings
- Override device-derived data

Manual edits are clearly labeled and source-attributed.


V1 focuses only on getting data from Garmin