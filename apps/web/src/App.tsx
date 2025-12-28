import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useChatStore, useFoodStore, useWorkoutStore, useSettingsStore } from './lib/store';

// Simple Card component using react-native-web
const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[{ backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, marginBottom: 16 }, style]}>
    {children}
  </View>
);

const CardMetric = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>{value}</Text>
    <Text style={{ fontSize: 12, color: '#6b7280' }}>{label}</Text>
    <Text style={{ fontSize: 10, color: '#9ca3af' }}>{unit}</Text>
  </View>
);

const Chat = ({
  messages,
  onSendMessage,
  isLoading,
}: {
  messages: Array<{ role: string; content: string }>;
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}) => {
  const [input, setInput] = useState('');

  return (
    <View>
      <View style={{ maxHeight: 200, marginBottom: 12 }}>
        <ScrollView style={{ maxHeight: 150 }}>
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={{
                backgroundColor: msg.role === 'user' ? '#6366f1' : '#e5e7eb',
                padding: 12,
                borderRadius: 8,
                marginBottom: 8,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
              }}
            >
              <Text style={{ color: msg.role === 'user' ? '#ffffff' : '#111827', fontSize: 14 }}>
                {msg.content}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Log workout, meal, or sleep..."
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            border: '1px solid #d1d5db',
            fontSize: 14,
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              onSendMessage(input);
              setInput('');
            }
          }}
        />
        <TouchableOpacity
          onPress={() => {
            if (input.trim()) {
              onSendMessage(input);
              setInput('');
            }
          }}
          style={{
            backgroundColor: '#6366f1',
            paddingHorizontal: 20,
            borderRadius: 8,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '600' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'exercises' | 'food' | 'sleep' | 'metabolism'>('overview');
  const { messages, addMessage, isLoading } = useChatStore();
  const { dailyCalories, dailyProtein, dailyCarbs, dailyFat, mealInstances, logQuickMeal } = useFoodStore();
  const { isActive: isWorkoutActive, currentSession, startWorkout, endWorkout } = useWorkoutStore();
  const { darkMode, toggleDarkMode } = useSettingsStore();

  // Theme colors based on dark mode
  const colors = darkMode ? {
    background: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    card: '#374151',
    border: '#4b5563',
    primary: '#6366f1',
    success: '#10b981',
  } : {
    background: '#ffffff',
    text: '#111827',
    textSecondary: '#6b7280',
    card: '#f3f4f6',
    border: '#e5e7eb',
    primary: '#6366f1',
    success: '#10b981',
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    navContainer: {
      flexDirection: 'row',
      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 8,
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    navItemActive: {
      borderTopWidth: 2,
      borderTopColor: colors.primary,
    },
    navText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    navTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
  });

  const NavItem = ({ label, tab }: { label: string; tab: typeof activeTab }) => (
    <TouchableOpacity
      style={[styles.navItem, activeTab === tab && styles.navItemActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.navText, activeTab === tab && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderOverview = () => (
    <ScrollView style={styles.scrollView}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fitness Tracker</Text>

        {/* Daily Stats */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <CardMetric label="Calories" value={dailyCalories.toString()} unit="kcal" />
            <CardMetric label="Protein" value={dailyProtein.toString()} unit="g" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
            <CardMetric label="Carbs" value={dailyCarbs.toString()} unit="g" />
            <CardMetric label="Fat" value={dailyFat.toString()} unit="g" />
          </View>
        </Card>

        {/* Active Workout */}
        {isWorkoutActive && currentSession && (
          <Card style={{ backgroundColor: colors.success }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>
              Active Workout
            </Text>
            <Text style={{ fontSize: 14, color: '#ffffff', marginTop: 4 }}>
              Started at {new Date(currentSession.startTimestamp).toLocaleTimeString()}
            </Text>
            <TouchableOpacity
              onPress={endWorkout}
              style={{
                backgroundColor: '#ffffff',
                padding: 8,
                borderRadius: 6,
                marginTop: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.success, fontWeight: '600' }}>End Workout</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Chat */}
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }}>
            Quick Log
          </Text>
          <Chat
            messages={messages}
            onSendMessage={(text) => {
              addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
              addMessage({
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Logged: "${text}". In production, this would be processed by AI.`,
                timestamp: new Date(),
              });
            }}
            isLoading={isLoading}
          />
        </Card>
      </View>
    </ScrollView>
  );

  const renderFood = () => (
    <ScrollView style={styles.scrollView}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nutrition</Text>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <CardMetric label="Calories" value={dailyCalories.toString()} unit="kcal" />
            <CardMetric label="Protein" value={dailyProtein.toString()} unit="g" />
            <CardMetric label="Carbs" value={dailyCarbs.toString()} unit="g" />
            <CardMetric label="Fat" value={dailyFat.toString()} unit="g" />
          </View>
        </Card>

        <Text style={{ fontSize: 16, color: colors.text, marginBottom: 16 }}>
          Today's Meals: {mealInstances.length}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['Banana', 'Chicken Breast', 'Rice', 'Eggs', 'Oatmeal'].map((food) => (
            <TouchableOpacity
              key={food}
              onPress={() => logQuickMeal(food, 200, 15, 30, 5)}
              style={{
                backgroundColor: colors.primary,
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
                minWidth: 100,
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600' }}>+ {food}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {mealInstances.map((meal) => (
          <Card key={meal.id}>
            <Text style={{ color: colors.text }}>
              Meal: {meal.calories} kcal | P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g
            </Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );

  const renderExercises = () => (
    <ScrollView style={styles.scrollView}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exercises & Workouts</Text>

        {isWorkoutActive ? (
          <Card style={{ backgroundColor: colors.success }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>
              Workout In Progress
            </Text>
            <Text style={{ fontSize: 14, color: '#ffffff', marginTop: 4 }}>
              Session: {currentSession?.id.slice(-8)}
            </Text>
            <TouchableOpacity
              onPress={endWorkout}
              style={{
                backgroundColor: '#ffffff',
                padding: 12,
                borderRadius: 8,
                marginTop: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.success, fontWeight: '600' }}>End Workout</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <TouchableOpacity
            onPress={startWorkout}
            style={{
              backgroundColor: colors.success,
              padding: 16,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16 }}>Start Workout</Text>
          </TouchableOpacity>
        )}

        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 20 }}>
          Exercise library and tracking coming soon
        </Text>
      </View>
    </ScrollView>
  );

  const renderSleep = () => (
    <ScrollView style={styles.scrollView}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sleep Tracking</Text>
        <Card>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>
            Sleep tracking data will appear here
          </Text>
        </Card>
      </View>
    </ScrollView>
  );

  const renderMetabolism = () => (
    <ScrollView style={styles.scrollView}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Metabolism</Text>
        <Card>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>
            Metabolic state information will appear here
          </Text>
        </Card>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'food': return renderFood();
      case 'exercises': return renderExercises();
      case 'sleep': return renderSleep();
      case 'metabolism': return renderMetabolism();
      default: return renderOverview();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fitness Tracker</Text>
        <TouchableOpacity onPress={toggleDarkMode}>
          <Text style={{ color: colors.primary, fontSize: 14 }}>
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>

      <View style={styles.navContainer}>
        <NavItem label="Overview" tab="overview" />
        <NavItem label="Exercises" tab="exercises" />
        <NavItem label="Food" tab="food" />
        <NavItem label="Sleep" tab="sleep" />
        <NavItem label="Metabolism" tab="metabolism" />
      </View>
    </View>
  );
}
