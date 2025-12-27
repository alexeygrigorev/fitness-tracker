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
import { useFoodStore } from '../../lib/store';
import { openaiService } from '../../lib/openai';

const MEAL_CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Post-Workout'];

const SAMPLE_FOODS = [
  { id: '1', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, category: 'PROTEIN' },
  { id: '2', name: 'Brown Rice', calories: 112, protein: 2.6, carbs: 24, fat: 0.9, category: 'CARB' },
  { id: '3', name: 'Broccoli', calories: 55, protein: 3.7, carbs: 11, fat: 0.6, category: 'CARB' },
  { id: '4', name: 'Eggs', calories: 155, protein: 13, carbs: 1.1, fat: 11, category: 'PROTEIN' },
  { id: '5', name: 'Oatmeal', calories: 389, protein: 17, carbs: 66, fat: 7, category: 'CARB' },
  { id: '6', name: 'Salmon', calories: 208, protein: 20, carbs: 0, fat: 13, category: 'PROTEIN' },
  { id: '7', name: 'Banana', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, category: 'CARB' },
  { id: '8', name: 'Almonds', calories: 579, protein: 21, carbs: 22, fat: 50, category: 'FAT' },
];

export default function FoodScreen() {
  const { todayMeals, dailyCalories, dailyProtein, dailyCarbs, dailyFat, addMeal } = useFoodStore();
  const [selectedCategory, setSelectedCategory] = useState('Lunch');
  const [foodDescription, setFoodDescription] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const handleQuickLog = async () => {
    if (!foodDescription.trim()) return;

    setIsParsing(true);
    const parsed = await openaiService.parseFood(foodDescription);

    if (parsed?.foodName) {
      addMeal({
        id: Date.now().toString(),
        name: parsed.foodName,
        calories: parsed.calories,
        protein: parsed.protein,
        carbs: parsed.carbs,
        fat: parsed.fat,
        timestamp: new Date().toISOString(),
      });
      setFoodDescription('');
    }

    setIsParsing(false);
  };

  const handleQuickAdd = (food: typeof SAMPLE_FOODS[0]) => {
    addMeal({
      id: Date.now().toString(),
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Food</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Daily Stats */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <CardMetric label="Calories" value={dailyCalories} unit="kcal" color="#10b981" />
          </Card>
          <Card style={styles.statCard}>
            <CardMetric label="Protein" value={dailyProtein} unit="g" color="#3b82f6" />
          </Card>
          <Card style={styles.statCard}>
            <CardMetric label="Carbs" value={dailyCarbs} unit="g" color="#f59e0b" />
          </Card>
          <Card style={styles.statCard}>
            <CardMetric label="Fat" value={dailyFat} unit="g" color="#ef4444" />
          </Card>
        </View>

        {/* Quick Log with AI */}
        <Card style={styles.quickLogCard}>
          <CardHeader
            title="Quick Log with AI"
            subtitle="Describe what you ate naturally"
            icon={<Ionicons name="sparkles" size={20} color="#6366f1" />}
          />
          <TextInput
            style={styles.quickLogInput}
            value={foodDescription}
            onChangeText={setFoodDescription}
            placeholder="e.g., Grilled chicken breast with brown rice and broccoli..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
          <View style={styles.categorySelector}>
            {MEAL_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategory === category && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === category && styles.categoryChipTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button
            title={isParsing ? 'Analyzing...' : 'Log Meal'}
            onPress={handleQuickLog}
            loading={isParsing}
            disabled={!foodDescription.trim()}
          />
        </Card>

        {/* Quick Add Foods */}
        <Card style={styles.foodsCard}>
          <CardHeader
            title="Quick Add"
            subtitle="Common foods"
            icon={<Ionicons name="flash" size={20} color="#f59e0b" />}
          />
          {SAMPLE_FOODS.map((food) => (
            <TouchableOpacity
              key={food.id}
              style={styles.foodRow}
              onPress={() => handleQuickAdd(food)}
            >
              <View style={styles.foodInfo}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodMacros}>
                  {food.protein}P • {food.carbs}C • {food.fat}F • {food.calories} kcal
                </Text>
              </View>
              <View style={styles.foodAdd}>
                <Ionicons name="add-circle" size={28} color="#6366f1" />
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Today's Meals */}
        {todayMeals.length > 0 && (
          <Card style={styles.mealsCard}>
            <CardHeader
              title="Today's Meals"
              subtitle={`${todayMeals.length} logged`}
              icon={<Ionicons name="restaurant-outline" size={20} color="#10b981" />}
            />
            {todayMeals.map((meal: any, index: number) => (
              <View key={meal.id || index} style={styles.mealItem}>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealMacros}>
                  {meal.calories} kcal • P:{meal.protein} C:{meal.carbs} F:{meal.fat}
                </Text>
              </View>
            ))}
          </Card>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  date: {
    fontSize: 16,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
  },
  quickLogCard: {
    marginBottom: 16,
  },
  quickLogInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1f2937',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  foodsCard: {
    marginBottom: 16,
  },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  foodMacros: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  foodAdd: {},
  mealsCard: {
    marginBottom: 20,
  },
  mealItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  mealName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  mealMacros: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});
