import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardHeader, CardMetric, Button } from '@fitness-tracker/ui';

export default function SleepScreen() {
  const [sleepHours, setSleepHours] = useState('8');
  const [sleepMinutes, setSleepMinutes] = useState('0');
  const [sleepQuality, setSleepQuality] = useState(3);
  const [hasLoggedToday, setHasLoggedToday] = useState(false);

  const handleLogSleep = () => {
    setHasLoggedToday(true);
  };

  const getQualityLabel = (score: number) => {
    if (score <= 2) return 'Poor';
    if (score <= 3) return 'Fair';
    if (score <= 4) return 'Good';
    return 'Excellent';
  };

  const getQualityColor = (score: number) => {
    if (score <= 2) return '#ef4444';
    if (score <= 3) return '#f59e0b';
    if (score <= 4) return '#10b981';
    return '#059669';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep</Text>
        <TouchableOpacity style={styles.garminButton}>
          <Ionicons name="watch" size={18} color="#6b7280" />
          <Text style={styles.garminButtonText}>Connect Garmin</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Today's Sleep Entry */}
        <Card style={styles.logCard}>
          <CardHeader
            title={hasLoggedToday ? "Today's Sleep" : 'Log Last Night'}
            subtitle={hasLoggedToday ? 'Logged for today' : 'Track your rest'}
            icon={<Ionicons name="moon" size={20} color="#6366f1" />}
          />

          {!hasLoggedToday ? (
            <View style={styles.logContent}>
              <Text style={styles.logLabel}>How many hours did you sleep?</Text>

              <View style={styles.timeInputContainer}>
                <View style={styles.timeInput}>
                  <TextInput
                    style={styles.timeInputField}
                    value={sleepHours}
                    onChangeText={setSleepHours}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={styles.timeInputSuffix}>h</Text>
                </View>
                <Text style={styles.timeSeparator}>:</Text>
                <View style={styles.timeInput}>
                  <TextInput
                    style={styles.timeInputField}
                    value={sleepMinutes}
                    onChangeText={setSleepMinutes}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={styles.timeInputSuffix}>m</Text>
                </View>
              </View>

              <Text style={styles.qualityLabel}>Sleep Quality</Text>
              <View style={styles.qualitySelector}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.qualityOption,
                      sleepQuality === score && styles.qualityOptionActive,
                    ]}
                    onPress={() => setSleepQuality(score)}
                  >
                    <Text
                      style={[
                        styles.qualityOptionText,
                        sleepQuality === score && styles.qualityOptionTextActive,
                      ]}
                    >
                      {score}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.qualityLabel, { marginTop: 8 }]}>
                {getQualityLabel(sleepQuality)}
              </Text>

              <Button title="Log Sleep" onPress={handleLogSleep} size="large" />
            </View>
          ) : (
            <View style={styles.loggedContent}>
              <Text style={styles.loggedTime}>
                {sleepHours}h {sleepMinutes}m
              </Text>
              <Text style={styles.loggedQuality}>
                Quality: {getQualityLabel(sleepQuality)}/5
              </Text>
              <TouchableOpacity onPress={() => setHasLoggedToday(false)}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Weekly Stats */}
        <Card style={styles.statsCard}>
          <CardHeader
            title="This Week"
            subtitle="Your sleep patterns"
            icon={<Ionicons name="stats-chart" size={20} color="#8b5cf6" />}
          />
          <View style={styles.weeklyStats}>
            <View style={styles.weeklyStatItem}>
              <CardMetric label="Average" value="7.5" unit="hrs" />
            </View>
            <View style={styles.weeklyStatItem}>
              <CardMetric label="Best Night" value="8.5" unit="hrs" color="#10b981" />
            </View>
          </View>
        </Card>

        {/* Sleep Stages */}
        <Card style={styles.stagesCard}>
          <CardHeader
            title="Sleep Stages"
            subtitle="From your device"
            icon={<Ionicons name="layers" size={20} color="#06b6d4" />}
          />
          <View style={styles.stageRow}>
            <View style={styles.stageBar}>
              <View style={[styles.stageSegment, { backgroundColor: '#3b82f6', flex: 0.25 }]} />
              <View style={[styles.stageSegment, { backgroundColor: '#8b5cf6', flex: 0.55 }]} />
              <View style={[styles.stageSegment, { backgroundColor: '#10b981', flex: 0.15 }]} />
              <View style={[styles.stageSegment, { backgroundColor: '#f59e0b', flex: 0.05 }]} />
            </View>
          </View>
          <View style={styles.stageLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.legendText}>Deep 25%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
              <Text style={styles.legendText}>Light 55%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>REM 15%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Awake 5%</Text>
            </View>
          </View>
          <Text style={styles.deviceRequired}>
            Connect a device for detailed sleep tracking
          </Text>
        </Card>

        {/* Recent Sleep */}
        <Card style={styles.recentCard}>
          <CardHeader
            title="Recent Nights"
            subtitle="Sleep history"
            icon={<Ionicons name="time" size={20} color="#6b7280" />}
          />
          {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
            const date = new Date();
            date.setDate(date.getDate() - dayOffset);
            const hours = 6 + Math.random() * 3;
            const quality = Math.floor(3 + Math.random() * 3);

            return (
              <View key={dayOffset} style={styles.sleepDay}>
                <Text style={styles.sleepDayName}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <View style={styles.sleepBarContainer}>
                  <View
                    style={[
                      styles.sleepBar,
                      { width: `${(hours / 12) * 100}%`, backgroundColor: getQualityColor(quality) },
                    ]}
                  />
                </View>
                <Text style={styles.sleepHours}>{hours.toFixed(1)}h</Text>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  garminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  garminButtonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logCard: {
    marginBottom: 16,
  },
  logContent: {
    gap: 16,
  },
  logLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timeInputField: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    minWidth: 60,
    textAlign: 'center',
  },
  timeInputSuffix: {
    fontSize: 16,
    color: '#9ca3af',
    marginLeft: 4,
  },
  timeSeparator: {
    fontSize: 24,
    color: '#9ca3af',
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  qualitySelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  qualityOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  qualityOptionActive: {
    backgroundColor: '#6366f1',
    borderColor: '#4f46e5',
  },
  qualityOptionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6b7280',
  },
  qualityOptionTextActive: {
    color: '#fff',
  },
  loggedContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loggedTime: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1f2937',
  },
  loggedQuality: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
  editLink: {
    fontSize: 14,
    color: '#6366f1',
    marginTop: 12,
    fontWeight: '600',
  },
  statsCard: {
    marginBottom: 16,
  },
  weeklyStats: {
    flexDirection: 'row',
    gap: 12,
  },
  weeklyStatItem: {
    flex: 1,
  },
  stagesCard: {
    marginBottom: 16,
  },
  stageRow: {
    paddingVertical: 12,
  },
  stageBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stageSegment: {},
  stageLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
  deviceRequired: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
  },
  recentCard: {
    marginBottom: 20,
  },
  sleepDay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sleepDayName: {
    width: 50,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  sleepBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  sleepBar: {
    height: '100%',
    borderRadius: 4,
  },
  sleepHours: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
});
