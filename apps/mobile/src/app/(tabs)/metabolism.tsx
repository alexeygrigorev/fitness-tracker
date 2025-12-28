import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardHeader } from '@fitness-tracker/ui';
import { useMetabolismStore, useFoodStore, useWorkoutStore, useSleepStore } from '../../lib/store';
import {
  EnergyLevel,
  GlycogenLevel,
  InsulinLevel,
} from '@fitness-tracker/shared';

export default function MetabolismScreen() {
  const { current, contributingFactors, isLoading, calculateMetabolicState } = useMetabolismStore();
  const { mealInstances: todayMeals, dailyCarbs } = useFoodStore();
  const { isActive: isWorkoutActive, sessionHistory: recentWorkouts } = useWorkoutStore();
  const { lastNight } = useSleepStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Calculate metabolic state on mount
    calculateMetabolicState();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await calculateMetabolicState();
    setRefreshing(false);
  };

  const getStateConfig = (level: string) => {
    switch (level) {
      case 'VERY_HIGH':
      case 'FULL':
      case 'EXCELLENT':
        return { color: '#10b981', icon: 'checkmark-circle' };
      case 'HIGH':
      case 'GOOD':
        return { color: '#34d399', icon: 'trending-up' };
      case 'MODERATE':
        return { color: '#f59e0b', icon: 'remove-circle' };
      case 'LOW':
      case 'DEPLETED':
      case 'POOR':
        return { color: '#f97316', icon: 'warning' };
      case 'VERY_LOW':
      case 'VERY_POOR':
        return { color: '#ef4444', icon: 'alert-circle' };
      default:
        return { color: '#6b7280', icon: 'help-circle' };
    }
  };

  const getLevelWidth = (level: string): number => {
    switch (level) {
      case 'VERY_HIGH':
      case 'FULL':
      case 'EXCELLENT':
        return 100;
      case 'HIGH':
      case 'GOOD':
        return 75;
      case 'MODERATE':
        return 50;
      case 'LOW':
      case 'DEPLETED':
      case 'POOR':
        return 25;
      case 'VERY_LOW':
      case 'VERY_POOR':
        return 10;
      default:
        return 50;
    }
  };

  const getStateLabel = (level: string, type: 'energy' | 'glycogen' | 'insulin' | 'recovery' | 'fatigue'): string => {
    if (type === 'fatigue') {
      // Invert fatigue for display (low fatigue is good)
      switch (level) {
        case 'VERY_LOW': return 'Very Low (Excellent)';
        case 'LOW': return 'Low (Good)';
        case 'MODERATE': return 'Moderate';
        case 'HIGH': return 'High (Tired)';
        case 'VERY_HIGH': return 'Very High (Exhausted)';
        default: return level;
      }
    }
    return level;
  };

  const getStateIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'energy': return 'flash' as any;
      case 'glycogen': return 'battery-half' as any;
      case 'insulin': return 'water' as any;
      case 'recovery': return 'refresh' as any;
      case 'fatigue': return 'bed' as any;
      default: return 'pulse' as any;
    }
  };

  const getLastMealText = (): string => {
    if (todayMeals.length === 0) return 'No meals logged today';

    const lastMeal = todayMeals[todayMeals.length - 1];
    const hoursAgo = Math.floor((Date.now() - new Date(lastMeal.timestamp).getTime()) / (1000 * 60 * 60));

    // Derive meal name from ingredients
    const mealName = lastMeal.ingredients.length > 0
      ? lastMeal.ingredients.map(i => i.foodItem?.name || 'Food').join(', ')
      : 'Meal';

    if (hoursAgo < 1) return 'Just now';
    if (hoursAgo < 24) return `${hoursAgo}h ago (${mealName})`;
    return 'Yesterday';
  };

  const getLastWorkoutText = (): string => {
    if (isWorkoutActive) return 'Currently in progress';
    if (recentWorkouts.length === 0) return 'No recent workouts';

    // In a real implementation, we'd get the date from the workout
    return 'Recent workout logged';
  };

  const getSleepText = (): string => {
    if (!lastNight) return 'No sleep data logged';

    const hours = Math.floor(lastNight.duration / 60);
    const mins = lastNight.duration % 60;
    const quality = lastNight.quality > 80 ? 'Excellent' : lastNight.quality > 60 ? 'Good' : 'Fair';

    return `${hours}h ${mins}m, ${quality} quality`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Metabolism</Text>
        <Text style={styles.subtitle}>
          {current?.lastUpdated
            ? `Updated ${new Date(current.lastUpdated).toLocaleTimeString()}`
            : 'Current State'
          }
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {isLoading || refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Analyzing your data...</Text>
          </View>
        ) : current ? (
          <>
            {/* Current Metabolic State */}
            <Card style={styles.stateCard}>
              <CardHeader
                title="Your Current State"
                subtitle="Modeled based on your data"
                icon={<Ionicons name="pulse" size={20} color="#6366f1" />}
              />

              {/* Energy Availability */}
              <View style={styles.stateItem}>
                <View style={styles.stateHeader}>
                  <Ionicons
                    name={getStateIcon('energy')}
                    size={20}
                    color={getStateConfig(current.energyAvailability).color}
                  />
                  <Text style={styles.stateLabel}>Energy Availability</Text>
                </View>
                <View style={styles.stateBarContainer}>
                  <View
                    style={[
                      styles.stateBar,
                      {
                        width: `${getLevelWidth(current.energyAvailability)}%`,
                        backgroundColor: getStateConfig(current.energyAvailability).color,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.stateValue, { color: getStateConfig(current.energyAvailability).color }]}
                >
                  {getStateLabel(current.energyAvailability, 'energy')}
                </Text>
              </View>

              {/* Glycogen Status */}
              <View style={styles.stateItem}>
                <View style={styles.stateHeader}>
                  <Ionicons
                    name={getStateIcon('glycogen')}
                    size={20}
                    color={getStateConfig(current.glycogenStatus).color}
                  />
                  <Text style={styles.stateLabel}>Glycogen Stores</Text>
                </View>
                <View style={styles.stateBarContainer}>
                  <View
                    style={[
                      styles.stateBar,
                      {
                        width: `${getLevelWidth(current.glycogenStatus)}%`,
                        backgroundColor: getStateConfig(current.glycogenStatus).color,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.stateValue, { color: getStateConfig(current.glycogenStatus).color }]}
                >
                  {current.glycogenStatus}
                </Text>
              </View>

              {/* Insulin Activity */}
              <View style={styles.stateItem}>
                <View style={styles.stateHeader}>
                  <Ionicons
                    name={getStateIcon('insulin')}
                    size={20}
                    color={getStateConfig(current.insulinActivity).color}
                  />
                  <Text style={styles.stateLabel}>Insulin Activity</Text>
                </View>
                <View style={styles.stateBarContainer}>
                  <View
                    style={[
                      styles.stateBar,
                      {
                        width: `${getLevelWidth(current.insulinActivity)}%`,
                        backgroundColor: getStateConfig(current.insulinActivity).color,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.stateValue, { color: getStateConfig(current.insulinActivity).color }]}
                >
                  {current.insulinActivity}
                </Text>
              </View>

              {/* Recovery State */}
              <View style={styles.stateItem}>
                <View style={styles.stateHeader}>
                  <Ionicons
                    name={getStateIcon('recovery')}
                    size={20}
                    color={getStateConfig(current.recoveryState).color}
                  />
                  <Text style={styles.stateLabel}>Recovery Status</Text>
                </View>
                <View style={styles.stateBarContainer}>
                  <View
                    style={[
                      styles.stateBar,
                      {
                        width: `${getLevelWidth(current.recoveryState)}%`,
                        backgroundColor: getStateConfig(current.recoveryState).color,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.stateValue, { color: getStateConfig(current.recoveryState).color }]}
                >
                  {current.recoveryState}
                </Text>
              </View>

              {/* Fatigue Level */}
              <View style={styles.stateItem}>
                <View style={styles.stateHeader}>
                  <Ionicons
                    name={getStateIcon('fatigue')}
                    size={20}
                    color={getStateConfig(current.fatigueLevel).color}
                  />
                  <Text style={styles.stateLabel}>Fatigue Level</Text>
                </View>
                <View style={styles.stateBarContainer}>
                  <View
                    style={[
                      styles.stateBar,
                      {
                        width: `${100 - getLevelWidth(current.fatigueLevel)}%`, // Invert for fatigue
                        backgroundColor: getStateConfig(current.fatigueLevel).color,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.stateValue, { color: getStateConfig(current.fatigueLevel).color }]}
                >
                  {getStateLabel(current.fatigueLevel, 'fatigue')}
                </Text>
              </View>
            </Card>

            {/* What This Means - Dynamic based on current state */}
            <Card style={styles.infoCard}>
              <CardHeader
                title="What This Means"
                subtitle="Understanding your metabolism"
                icon={<Ionicons name="information-circle" size={20} color="#8b5cf6" />}
              />
              <View style={styles.infoContent}>
                {getInterpretation(current.energyAvailability, current.glycogenStatus, current.insulinActivity).map(
                  (item, index) => (
                    <View key={index} style={styles.infoItem}>
                      <View style={[styles.infoDot, { backgroundColor: item.color }]} />
                      <View style={styles.infoText}>
                        <Text style={styles.infoTitle}>{item.title}</Text>
                        <Text style={styles.infoDescription}>{item.description}</Text>
                      </View>
                    </View>
                  )
                )}
              </View>
            </Card>

            {/* Factors Affecting State - Real data */}
            <Card style={styles.factorsCard}>
              <CardHeader
                title="Contributing Factors"
                subtitle="What's influencing your state"
                icon={<Ionicons name="list" size={20} color="#f59e0b" />}
              />
              <View style={styles.factorsList}>
                <View style={styles.factorItem}>
                  <Text style={styles.factorName}>Recent Meals</Text>
                  <Text style={styles.factorValue}>{getLastMealText()}</Text>
                </View>
                <View style={styles.factorItem}>
                  <Text style={styles.factorName}>Today's Carbs</Text>
                  <Text style={styles.factorValue}>{dailyCarbs}g consumed</Text>
                </View>
                <View style={styles.factorItem}>
                  <Text style={styles.factorName}>Last Workout</Text>
                  <Text style={styles.factorValue}>{getLastWorkoutText()}</Text>
                </View>
                <View style={styles.factorItem}>
                  <Text style={styles.factorName}>Sleep Quality</Text>
                  <Text style={styles.factorValue}>{getSleepText()}</Text>
                </View>
                <View style={styles.factorItem}>
                  <Text style={styles.factorName}>Stress Level</Text>
                  <Text style={styles.factorValue}>
                    {contributingFactors.stressLevel < 40 ? 'Low' :
                     contributingFactors.stressLevel < 60 ? 'Moderate' : 'High'}
                    {' '} (estimated)
                  </Text>
                </View>
              </View>
            </Card>

            {/* Refresh Button */}
            <View style={styles.refreshContainer}>
              <Ionicons
                name="refresh"
                size={20}
                color={refreshing ? '#9ca3af' : '#6366f1'}
                onPress={handleRefresh}
              />
              <Text style={styles.refreshText} onPress={handleRefresh}>
                {refreshing ? 'Updating...' : 'Update State'}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No metabolic data yet</Text>
            <Text style={styles.emptyDescription}>
              Start logging meals, workouts, and sleep to see your metabolic state analysis.
            </Text>
          </View>
        )}

        {/* Learn More */}
        <Card style={styles.learnCard}>
          <CardHeader
            title="Learn More"
            subtitle="Educational content"
            icon={<Ionicons name="book" size={20} color="#6366f1" />}
          />
          <View style={styles.learnList}>
            <View style={styles.learnItem}>
              <Ionicons name="nutrition-outline" size={24} color="#10b981" />
              <View style={styles.learnText}>
                <Text style={styles.learnTitle}>Metabolic Flexibility</Text>
                <Text style={styles.learnDescription}>
                  How efficiently your body switches between fuel sources
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
            <View style={styles.learnItem}>
              <Ionicons name="barbell-outline" size={24} color="#6366f1" />
              <View style={styles.learnText}>
                <Text style={styles.learnTitle}>Training & Metabolism</Text>
                <Text style={styles.learnDescription}>
                  How different exercises affect your metabolic state
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
            <View style={styles.learnItem}>
              <Ionicons name="moon" size={24} color="#8b5cf6" />
              <View style={styles.learnText}>
                <Text style={styles.learnTitle}>Sleep & Recovery</Text>
                <Text style={styles.learnDescription}>
                  The connection between sleep and metabolic health
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper function to generate interpretation based on current state
function getInterpretation(
  energy: EnergyLevel,
  glycogen: GlycogenLevel,
  insulin: InsulinLevel
) {
  const interpretations: Array<{ title: string; description: string; color: string }> = [];

  // Energy interpretation
  if (energy === EnergyLevel.VERY_HIGH || energy === EnergyLevel.HIGH) {
    interpretations.push({
      title: 'High Energy',
      description: 'Your body has readily available fuel. Great time for intense training.',
      color: '#10b981',
    });
  } else if (energy === EnergyLevel.MODERATE) {
    interpretations.push({
      title: 'Moderate Energy',
      description: 'You have adequate fuel for moderate activity. Consider timing your next meal.',
      color: '#f59e0b',
    });
  } else {
    interpretations.push({
      title: 'Low Energy',
      description: 'Fuel stores are low. Consider eating before training.',
      color: '#f97316',
    });
  }

  // Glycogen interpretation
  if (glycogen === GlycogenLevel.FULL || glycogen === GlycogenLevel.MODERATE) {
    interpretations.push({
      title: 'Good Glycogen',
      description: 'Your muscle and liver carbs are well-stocked for exercise.',
      color: '#10b981',
    });
  } else {
    interpretations.push({
      title: 'Low Glycogen',
      description: 'Your muscle and liver carbs are depleted. Consider carbs before training.',
      color: '#f59e0b',
    });
  }

  // Insulin interpretation
  if (insulin === InsulinLevel.LOW) {
    interpretations.push({
      title: 'Low Insulin',
      description: 'Your body is in fat-burning mode. Ideal for low-intensity activity.',
      color: '#3b82f6',
    });
  } else if (insulin === InsulinLevel.MODERATE) {
    interpretations.push({
      title: 'Moderate Insulin',
      description: 'Your body is processing nutrients. Good for recovery.',
      color: '#f59e0b',
    });
  } else {
    interpretations.push({
      title: 'High Insulin',
      description: 'Your body is in storage mode. Focus on nutrient uptake.',
      color: '#8b5cf6',
    });
  }

  return interpretations.slice(0, 3);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  stateCard: {
    marginBottom: 16,
  },
  stateItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  stateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  stateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  stateBarContainer: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  stateBar: {
    height: '100%',
    borderRadius: 4,
  },
  stateValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'right',
  },
  infoCard: {
    marginBottom: 16,
  },
  infoContent: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  infoDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 18,
  },
  factorsCard: {
    marginBottom: 16,
  },
  factorsList: {
    gap: 12,
  },
  factorItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 10,
  },
  factorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  factorValue: {
    fontSize: 14,
    color: '#1f2937',
  },
  refreshContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  learnCard: {
    marginBottom: 20,
  },
  learnList: {
    gap: 4,
  },
  learnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  learnText: {
    flex: 1,
    marginLeft: 12,
  },
  learnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  learnDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});
