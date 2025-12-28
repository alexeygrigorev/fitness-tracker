import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardHeader, CardMetric, Button } from '@fitness-tracker/ui';
import { garminService } from '../../lib/garmin';
import { useSleepStore } from '../../lib/store';

export default function SleepScreen() {
  const [sleepHours, setSleepHours] = useState('8');
  const [sleepMinutes, setSleepMinutes] = useState('0');
  const [sleepQuality, setSleepQuality] = useState(3);
  const [hasLoggedToday, setHasLoggedToday] = useState(false);
  const [isGarminConnected, setIsGarminConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [garminError, setGarminError] = useState<string | null>(null);
  const [garminSleep, setGarminSleep] = useState<{
    duration: number;
    deepSleep: number;
    lightSleep: number;
    remSleep: number;
    score: number;
  } | null>(null); // Will be used to display sleep stages from Garmin

  const { logSleep } = useSleepStore();

  // Display Garmin sleep data if available (TODO: show in UI)
  void garminSleep;

  // Check Garmin connection on mount
  useEffect(() => {
    checkGarminConnection();
  }, []);

  const checkGarminConnection = async () => {
    const connected = await garminService.checkConnectionStatus();
    setIsGarminConnected(connected);
  };

  const handleConnectGarmin = async () => {
    setIsConnecting(true);
    setGarminError(null);
    try {
      const result = await garminService.connect();
      if (result.success) {
        setIsGarminConnected(true);
      } else {
        setGarminError(result.error || 'Failed to connect');
      }
    } catch (error) {
      setGarminError((error as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncFromGarmin = async () => {
    setIsSyncing(true);
    setGarminError(null);
    try {
      const sleepData = await garminService.syncSleep(new Date());
      if (sleepData) {
        const hours = Math.floor(sleepData.sleepTimeSeconds / 3600);
        const minutes = Math.floor((sleepData.sleepTimeSeconds % 3600) / 60);
        setSleepHours(hours.toString());
        setSleepMinutes(minutes.toString());
        if (sleepData.overallSleepScore) {
          setSleepQuality(Math.ceil(sleepData.overallSleepScore / 20));
        }
        setGarminSleep({
          duration: sleepData.sleepTimeSeconds,
          deepSleep: sleepData.deepSleepSeconds,
          lightSleep: sleepData.lightSleepSeconds,
          remSleep: sleepData.remSleepSeconds,
          score: sleepData.overallSleepScore || 0,
        });
      }
    } catch (error) {
      setGarminError((error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectGarmin = async () => {
    setIsConnecting(true);
    try {
      await garminService.disconnect();
      setIsGarminConnected(false);
      setGarminSleep(null);
    } catch (error) {
      setGarminError((error as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogSleep = async () => {
    const hours = parseInt(sleepHours) || 0;
    const minutes = parseInt(sleepMinutes) || 0;
    const duration = hours * 60 + minutes;

    // Create bedtime and wake time from duration
    const wakeTime = new Date();
    const bedtime = new Date(wakeTime.getTime() - duration * 60000);

    try {
      await logSleep({
        bedtime,
        wakeTime,
        duration,
        quality: sleepQuality,
      });
      setHasLoggedToday(true);
    } catch (error) {
      setGarminError((error as Error).message);
    }
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
        <View style={styles.headerButtons}>
          {isGarminConnected ? (
            <>
              <TouchableOpacity
                style={[styles.garminButton, styles.connectedButton]}
                onPress={handleSyncFromGarmin}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#10b981" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={18} color="#10b981" />
                    <Text style={styles.garminButtonTextConnected}>Sync</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={handleDisconnectGarmin}
                disabled={isConnecting}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.garminButton}
              onPress={handleConnectGarmin}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <>
                  <Ionicons name="watch" size={18} color="#6366f1" />
                  <Text style={styles.garminButtonText}>Connect Garmin</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {garminError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{garminError}</Text>
          <TouchableOpacity onPress={() => setGarminError(null)}>
            <Ionicons name="close" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  connectedButton: {
    backgroundColor: '#d1fae5',
  },
  garminButtonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  garminButtonTextConnected: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '500',
  },
  disconnectButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  disconnectButtonText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#b91c1c',
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
