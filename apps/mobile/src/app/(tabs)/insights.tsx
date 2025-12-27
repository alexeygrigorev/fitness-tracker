import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardHeader } from '@fitness-tracker/ui';

export default function InsightsScreen() {
  const adviceItems = [
    {
      id: '1',
      title: 'Great Workout Today!',
      message: 'You hit a new PR on bench press. Your progressive overload is paying off. Consider taking a rest day tomorrow to optimize recovery.',
      trigger: 'POST_WORKOUT',
      icon: 'trophy',
      color: '#f59e0b',
      isNew: true,
    },
    {
      id: '2',
      title: 'Protein Intake',
      message: "You're at 120g protein today. Consider adding a protein-rich snack to reach your target of 150g for optimal muscle recovery.",
      trigger: 'CALORIE_PACING',
      icon: 'nutrition-outline',
      color: '#10b981',
      isNew: true,
    },
    {
      id: '3',
      title: 'Sleep Quality Improving',
      message: 'Your sleep score has increased 15% this week. Keep up the good bedtime routine for continued gains.',
      trigger: 'END_OF_DAY',
      icon: 'moon',
      color: '#8b5cf6',
      isNew: false,
    },
  ];

  const insights = [
    {
      id: '1',
      title: 'Training Consistency',
      value: '85%',
      trend: 'up',
      description: 'You\'ve worked out 5 of the last 7 days',
      icon: 'calendar',
      color: '#10b981',
    },
    {
      id: '2',
      title: 'Weekly Volume',
      value: '12,500 kg',
      trend: 'up',
      description: 'Up 8% from last week',
      icon: 'barbell-outline',
      color: '#3b82f6',
    },
    {
      id: '3',
      title: 'Nutrition Adherence',
      value: '78%',
      trend: 'neutral',
      description: 'Hitting most macro targets',
      icon: 'restaurant-outline',
      color: '#f59e0b',
    },
    {
      id: '4',
      title: 'Recovery Score',
      value: 'Good',
      trend: 'up',
      description: 'Based on HRV and sleep',
      icon: 'heart',
      color: '#ef4444',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>AI-Powered Recommendations</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Personalized Advice */}
        <Card style={styles.adviceCard}>
          <CardHeader
            title="For You"
            subtitle="Personalized recommendations"
            icon={<Ionicons name="sparkles" size={20} color="#6366f1" />}
          />
          {adviceItems.map((advice) => (
            <TouchableOpacity key={advice.id} style={styles.adviceItem}>
              <View style={styles.adviceHeader}>
                <View style={[styles.adviceIcon, { backgroundColor: `${advice.color}20` }]}>
                  <Ionicons name={advice.icon as any} size={20} color={advice.color} />
                </View>
                <View style={styles.adviceHeaderRight}>
                  <View style={styles.adviceTitleRow}>
                    <Text style={styles.adviceTitle}>{advice.title}</Text>
                    {advice.isNew && <View style={styles.newBadge} />}
                  </View>
                  <Text style={styles.adviceTrigger}>{advice.trigger.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.adviceMessage}>{advice.message}</Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Key Insights */}
        <Card style={styles.insightsCard}>
          <CardHeader
            title="This Week"
            subtitle="Your performance at a glance"
            icon={<Ionicons name="stats-chart" size={20} color="#8b5cf6" />}
          />
          <View style={styles.insightsGrid}>
            {insights.map((insight) => (
              <View key={insight.id} style={styles.insightItem}>
                <View style={[styles.insightIcon, { backgroundColor: `${insight.color}20` }]}>
                  <Ionicons name={insight.icon as any} size={22} color={insight.color} />
                </View>
                <Text style={styles.insightValue}>{insight.value}</Text>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightDescription}>{insight.description}</Text>
                <View style={styles.insightTrend}>
                  <Ionicons
                    name={
                      insight.trend === 'up'
                        ? 'arrow-up'
                        : insight.trend === 'down'
                        ? 'arrow-down'
                        : 'remove'
                    }
                    size={14}
                    color={insight.trend === 'up' ? '#10b981' : insight.trend === 'down' ? '#ef4444' : '#9ca3af'}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Patterns */}
        <Card style={styles.patternsCard}>
          <CardHeader
            title="Patterns"
            subtitle="What we've noticed"
            icon={<Ionicons name="analytics" size={20} color="#06b6d4" />}
          />
          <View style={styles.patternContent}>
            <View style={styles.patternItem}>
              <View style={styles.patternHeader}>
                <Ionicons name="barbell" size={20} color="#6366f1" />
                <Text style={styles.patternTitle}>Training Pattern</Text>
              </View>
              <Text style={styles.patternDescription}>
                You perform best on workouts scheduled between 4-6 PM. Consider scheduling important sessions during this window.
              </Text>
            </View>
            <View style={styles.patternItem}>
              <View style={styles.patternHeader}>
                <Ionicons name="nutrition" size={20} color="#10b981" />
                <Text style={styles.patternTitle}>Nutrition Pattern</Text>
              </View>
              <Text style={styles.patternDescription}>
                Higher protein intake at breakfast correlates with better energy levels throughout the day.
              </Text>
            </View>
            <View style={styles.patternItem}>
              <View style={styles.patternHeader}>
                <Ionicons name="moon" size={20} color="#8b5cf6" />
                <Text style={styles.patternTitle}>Sleep Pattern</Text>
              </View>
              <Text style={styles.patternDescription}>
                7+ hours of sleep consistently improves your workout performance the following day.
              </Text>
            </View>
          </View>
        </Card>

        {/* Goals Progress */}
        <Card style={styles.goalsCard}>
          <CardHeader
            title="Goals Progress"
            subtitle="Tracking your targets"
            icon={<Ionicons name="flag" size={20} color="#f59e0b" />}
          />
          <View style={styles.goalItem}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalTitle}>Bench Press 100kg</Text>
              <Text style={styles.goalProgress}>85%</Text>
            </View>
            <View style={styles.goalBarContainer}>
              <View style={[styles.goalBar, { width: '85%', backgroundColor: '#6366f1' }]} />
            </View>
            <Text style={styles.goalStatus}>Current: 85kg • Target: 100kg</Text>
          </View>
          <View style={styles.goalItem}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalTitle}>Weight 75kg</Text>
              <Text style={styles.goalProgress}>60%</Text>
            </View>
            <View style={styles.goalBarContainer}>
              <View style={[styles.goalBar, { width: '60%', backgroundColor: '#10b981' }]} />
            </View>
            <Text style={styles.goalStatus}>Current: 78kg • Target: 75kg</Text>
          </View>
        </Card>

        {/* Ask AI */}
        <Card style={styles.askCard}>
          <CardHeader
            title="Ask AI Coach"
            subtitle="Get personalized answers"
            icon={<Ionicons name="chatbubbles" size={20} color="#ec4899" />}
          />
          <View style={styles.askQuestions}>
            <TouchableOpacity style={styles.askQuestion}>
              <Text style={styles.askQuestionText}>"How can I improve my bench press?"</Text>
              <Ionicons name="arrow-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.askQuestion}>
              <Text style={styles.askQuestionText}>"What should I eat before training?"</Text>
              <Ionicons name="arrow-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.askQuestion}>
              <Text style={styles.askQuestionText}>"Am I getting enough protein?"</Text>
              <Ionicons name="arrow-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>
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
  adviceCard: {
    marginBottom: 16,
  },
  adviceItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  adviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  adviceHeaderRight: {
    flex: 1,
  },
  adviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adviceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  newBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  adviceTrigger: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  adviceMessage: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    marginLeft: 48,
  },
  insightsCard: {
    marginBottom: 16,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  insightItem: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  insightTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  insightDescription: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
    textAlign: 'center',
  },
  insightTrend: {
    marginTop: 6,
  },
  patternsCard: {
    marginBottom: 16,
  },
  patternContent: {
    gap: 16,
  },
  patternItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  patternTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  patternDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  goalsCard: {
    marginBottom: 16,
  },
  goalItem: {
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  goalProgress: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
  },
  goalBarContainer: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalBar: {
    height: '100%',
    borderRadius: 4,
  },
  goalStatus: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
  },
  askCard: {
    marginBottom: 20,
  },
  askQuestions: {
    gap: 2,
  },
  askQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  askQuestionText: {
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
  },
});
