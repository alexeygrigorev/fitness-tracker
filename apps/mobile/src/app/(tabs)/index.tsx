import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardMetric, Chat } from '@fitness-tracker/ui';
import { useChatStore, useFoodStore, useWorkoutStore, useSettingsStore } from '../../lib/store';
import { apiService } from '../../lib/amplify';
import { useTheme } from '../../lib/ThemeProvider';

export default function OverviewScreen() {
  const { messages, addMessage, setLoading, isLoading } = useChatStore();
  const { dailyCalories, dailyProtein, dailyCarbs, dailyFat } = useFoodStore();
  const { isActive: isWorkoutActive, currentSession: currentWorkout, startWorkout, endWorkout } = useWorkoutStore();
  const { darkMode } = useSettingsStore();
  const theme = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleSendMessage = async (text: string) => {
    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: text,
      timestamp: new Date(),
    };
    addMessage(userMessage);
    setLoading(true);

    try {
      // Call Lambda function via GraphQL for AI processing
      const response = await apiService.mutate(
        `
          mutation FitnessAI($input: FitnessAIInput!) {
            fitnessAI(action: parseWorkout, input: $input) {
              success
              data
              error
              confidence
            }
          }
        `,
        {
          input: {
            action: 'parseWorkout',
            description: text,
            userId: 'local-user',
          },
        }
      );

      if (response.fitnessAI?.success && response.fitnessAI.data) {
        // Successfully parsed workout
        const workoutData = response.fitnessAI.data;
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Logged your workout: ${workoutData.exercises?.length || 0} exercises`,
          timestamp: new Date(),
        });

        if (!isWorkoutActive) {
          startWorkout();
        }
      } else {
        // Try parsing as food
        const foodResponse = await apiService.mutate(
          `
            mutation FitnessAI($input: FitnessAIInput!) {
              fitnessAI(action: parseFood, input: $input) {
                success
                data
                error
                confidence
              }
            }
          `,
          {
            input: {
              action: 'parseFood',
              description: text,
              userId: 'local-user',
            },
          }
        );

        if (foodResponse.fitnessAI?.success && foodResponse.fitnessAI.data) {
          const foodData = foodResponse.fitnessAI.data;
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Logged: ${foodData.foodName || 'Food'} - ${foodData.calories || 0} calories`,
            timestamp: new Date(),
          });

          useFoodStore.getState().logQuickMeal(
            foodData.foodName || 'Food',
            foodData.calories || 0,
            foodData.protein || 0,
            foodData.carbs || 0,
            foodData.fat || 0,
            'SNACK' as any
          );
        } else {
          // General chat - for now return a demo response
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: "I understand! For now, I can help you log workouts and meals. Try saying something like 'Bench press 5x5 at 100kg' or 'I had chicken with rice for lunch'.",
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('AI service error:', error);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Make sure your backend is configured.",
        timestamp: new Date(),
      });
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Log a workout',
    'Log a meal',
    'How am I doing today?',
    'Start a workout',
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: theme.colors.text }]}>
            Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 18 ? 'Afternoon' : 'Evening'}
          </Text>
          <Text style={[styles.date, { color: theme.colors.textSecondary }]}>
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Daily Stats */}
        <View style={styles.statsRow}>
          <Card style={{ ...styles.statCard, backgroundColor: theme.colors.card }}>
            <CardMetric
              label="Calories"
              value={dailyCalories}
              unit="kcal"
              color="#10b981"
            />
          </Card>
          <Card style={{ ...styles.statCard, backgroundColor: theme.colors.card }}>
            <CardMetric
              label="Protein"
              value={dailyProtein}
              unit="g"
              color="#3b82f6"
            />
          </Card>
        </View>

        <View style={styles.statsRow}>
          <Card style={{ ...styles.statCard, backgroundColor: theme.colors.card }}>
            <CardMetric
              label="Carbs"
              value={dailyCarbs}
              unit="g"
              color="#f59e0b"
            />
          </Card>
          <Card style={{ ...styles.statCard, backgroundColor: theme.colors.card }}>
            <CardMetric
              label="Fat"
              value={dailyFat}
              unit="g"
              color="#ef4444"
            />
          </Card>
        </View>

        {/* Active Workout Indicator */}
        {isWorkoutActive && (
          <Card style={{ ...styles.workoutCard, backgroundColor: darkMode ? '#451a03' : '#fef3c7', borderColor: darkMode ? '#78350f' : '#fbbf24' }}>
            <View style={styles.workoutHeader}>
              <View style={styles.workoutIndicator}>
                <View style={styles.workoutDot} />
                <Text style={{ ...styles.workoutStatus, color: darkMode ? '#fef3c7' : '#92400e' }}>Workout in Progress</Text>
              </View>
              <TouchableOpacity onPress={() => endWorkout()} style={styles.endWorkoutButton}>
                <Text style={{ ...styles.endWorkoutText, color: '#78350f' }}>End</Text>
              </TouchableOpacity>
            </View>
            {currentWorkout && (
              <Text style={{ ...styles.workoutTime, color: darkMode ? '#fef3c7' : '#92400e' }}>
                Started at {new Date(currentWorkout.startTimestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </Card>
        )}

        {/* Chat Suggestions */}
        {!isLoading && messages.length <= 1 && (
          <View style={styles.suggestionsSection}>
            <Text style={{ ...styles.suggestionsTitle, color: theme.colors.textSecondary }}>Quick Actions</Text>
            <View style={styles.suggestionButtons}>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={{ ...styles.suggestionButton, backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
                  onPress={() => handleSendMessage(suggestion)}
                >
                  <Ionicons name="flash" size={16} color="#6366f1" />
                  <Text style={{ ...styles.suggestionButtonText, color: theme.colors.textSecondary }}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Chat Messages */}
        <View style={{ ...styles.chatContainer, backgroundColor: theme.colors.backgroundSecondary, borderTopColor: theme.colors.border }}>
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            placeholder="Tell me about your workout, meal, or how you're feeling..."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1f2937',
  },
  date: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
  },
  workoutCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  workoutStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  endWorkoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fbbf24',
    borderRadius: 8,
  },
  endWorkoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350f',
  },
  workoutTime: {
    fontSize: 12,
    color: '#92400e',
    marginTop: 8,
  },
  suggestionsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
  },
  suggestionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  suggestionButtonText: {
    fontSize: 13,
    color: '#4b5563',
  },
  chatContainer: {
    flex: 1,
    minHeight: 400,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});
