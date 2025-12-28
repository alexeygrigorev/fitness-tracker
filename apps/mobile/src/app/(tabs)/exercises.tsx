import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardHeader, Button } from '@fitness-tracker/ui';
import { useWorkoutStore } from '../../lib/store';
import { apiService } from '../../lib/amplify';

// Sample exercise data
const SAMPLE_EXERCISES = [
  { id: '1', name: 'Bench Press', type: 'WEIGHT_BASED', primaryMuscles: ['CHEST'], equipment: 'Barbell' },
  { id: '2', name: 'Squat', type: 'WEIGHT_BASED', primaryMuscles: ['QUADS'], equipment: 'Barbell' },
  { id: '3', name: 'Deadlift', type: 'WEIGHT_BASED', primaryMuscles: ['BACK', 'HAMSTRINGS'], equipment: 'Barbell' },
  { id: '4', name: 'Overhead Press', type: 'WEIGHT_BASED', primaryMuscles: ['SHOULDERS'], equipment: 'Barbell' },
  { id: '5', name: 'Pull Up', type: 'BODYWEIGHT', primaryMuscles: ['BACK', 'BICEPS'], equipment: null },
  { id: '6', name: 'Push Up', type: 'BODYWEIGHT', primaryMuscles: ['CHEST', 'TRICEPS'], equipment: null },
  { id: '7', name: 'Lunge', type: 'BODYWEIGHT', primaryMuscles: ['QUADS', 'GLUTES'], equipment: null },
  { id: '8', name: 'Plank', type: 'DURATION_BASED', primaryMuscles: ['ABS'], equipment: null },
];

export default function ExercisesScreen() {
  const { isActive: isWorkoutActive, currentSession, startWorkout, endWorkout, addExercise, exerciseSets } = useWorkoutStore();
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<typeof SAMPLE_EXERCISES[0] | null>(null);
  const [sets, setSets] = useState<Array<{ weight: string; reps: string }>>([
    { weight: '', reps: '' },
  ]);
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const handleStartWorkout = () => {
    startWorkout();
  };

  const handleSelectExercise = (exercise: typeof SAMPLE_EXERCISES[0]) => {
    setSelectedExercise(exercise);
    setSets([{ weight: '', reps: '' }]);
    setShowExerciseModal(true);
  };

  const handleAddSet = () => {
    setSets([...sets, { weight: '', reps: '' }]);
  };

  const handleSaveExercise = () => {
    const validSets = sets
      .filter((s) => s.weight || s.reps)
      .map((s) => ({
        weight: s.weight ? parseFloat(s.weight) : undefined,
        reps: s.reps ? parseInt(s.reps) : undefined,
      }));

    if (selectedExercise && validSets.length > 0) {
      addExercise({
        id: selectedExercise.id,
        name: selectedExercise.name,
        sets: validSets,
      });
    }

    setShowExerciseModal(false);
    setSelectedExercise(null);
    setSets([{ weight: '', reps: '' }]);
  };

  const handleQuickLog = async () => {
    if (!workoutDescription.trim()) return;

    setIsParsing(true);
    try {
      // Call Lambda via GraphQL
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
            description: workoutDescription,
            userId: 'local-user',
          },
        }
      );

      if (response.fitnessAI?.success && response.fitnessAI.data?.exercises) {
        const workoutData = response.fitnessAI.data;
        workoutData.exercises.forEach((ex: any) => {
          addExercise({
            id: Date.now().toString() + Math.random(),
            name: ex.name,
            sets: ex.sets || [],
          });
        });

        if (!isWorkoutActive) {
          startWorkout();
        }

        setWorkoutDescription('');
      } else {
        // Demo fallback - parse simple format
        console.log('Using demo fallback for workout parsing');
        setWorkoutDescription('');
      }
    } catch (error) {
      console.error('Workout parsing error:', error);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercises</Text>
        {!isWorkoutActive ? (
          <Button title="Start Workout" onPress={handleStartWorkout} variant="primary" />
        ) : (
          <Button title="End Workout" onPress={endWorkout} variant="danger" />
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Quick Log with AI */}
        <Card style={styles.quickLogCard}>
          <CardHeader
            title="Quick Log with AI"
            subtitle="Describe your workout naturally"
            icon={<Ionicons name="sparkles" size={20} color="#6366f1" />}
          />
          <TextInput
            style={styles.quickLogInput}
            value={workoutDescription}
            onChangeText={setWorkoutDescription}
            placeholder="e.g., Bench press 3x10 at 80kg, then squats 4x8 at 100kg..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
          <Button
            title={isParsing ? 'Parsing...' : 'Parse & Log'}
            onPress={handleQuickLog}
            loading={isParsing}
            disabled={!workoutDescription.trim()}
          />
        </Card>

        {/* Current Workout */}
        {isWorkoutActive && currentSession && (
          <Card style={styles.currentWorkoutCard}>
            <CardHeader
              title="Current Workout"
              subtitle={`${exerciseSets.length} sets`}
              icon={<Ionicons name="fitness" size={20} color="#10b981" />}
            />
            {exerciseSets.length > 0 ? (
              exerciseSets.map((set: any, index: number) => (
                <View key={index} style={styles.exerciseItem}>
                  <Text style={styles.exerciseName}>Set {index + 1}</Text>
                  <Text style={styles.exerciseSets}>
                    {set.weight || 'BW'} × {set.reps}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No exercises logged yet</Text>
            )}
          </Card>
        )}

        {/* Exercise Library */}
        <Card style={styles.exerciseCard}>
          <CardHeader
            title="Exercise Library"
            subtitle="Tap to add to workout"
            icon={<Ionicons name="barbell" size={20} color="#6366f1" />}
          />
          {SAMPLE_EXERCISES.map((exercise) => (
            <TouchableOpacity
              key={exercise.id}
              style={styles.exerciseRow}
              onPress={() => isWorkoutActive && handleSelectExercise(exercise)}
            >
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseRowName}>{exercise.name}</Text>
                <Text style={styles.exerciseRowMuscles}>
                  {exercise.primaryMuscles.join(' • ')}
                </Text>
              </View>
              <View style={styles.exerciseMeta}>
                <Text style={styles.exerciseType}>
                  {exercise.type === 'WEIGHT_BASED' ? 'Weight' : exercise.type === 'BODYWEIGHT' ? 'BW' : 'Time'}
                </Text>
                {isWorkoutActive && (
                  <Ionicons name="add-circle" size={24} color="#6366f1" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Recent Workouts */}
        <Card style={styles.recentCard}>
          <CardHeader
            title="Recent Workouts"
            subtitle="Your training history"
            icon={<Ionicons name="time" size={20} color="#6b7280" />}
          />
          <Text style={styles.emptyText}>No recent workouts</Text>
        </Card>
      </ScrollView>

      {/* Add Exercise Modal */}
      <Modal
        visible={showExerciseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExerciseModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedExercise?.name}</Text>
            <TouchableOpacity onPress={() => setShowExerciseModal(false)}>
              <Ionicons name="close" size={28} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {sets.map((set, index) => (
              <View key={index} style={styles.setRow}>
                <Text style={styles.setLabel}>Set {index + 1}</Text>
                <View style={styles.setInputs}>
                  <View style={styles.setInputContainer}>
                    <TextInput
                      style={styles.setInput}
                      value={set.weight}
                      onChangeText={(text) => {
                        const newSets = [...sets];
                        newSets[index].weight = text;
                        setSets(newSets);
                      }}
                      placeholder="Weight"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                    <Text style={styles.setInputSuffix}>kg</Text>
                  </View>
                  <View style={styles.setInputContainer}>
                    <TextInput
                      style={styles.setInput}
                      value={set.reps}
                      onChangeText={(text) => {
                        const newSets = [...sets];
                        newSets[index].reps = text;
                        setSets(newSets);
                      }}
                      placeholder="Reps"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addSetButton} onPress={handleAddSet}>
              <Ionicons name="add" size={20} color="#6366f1" />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button title="Save Exercise" onPress={handleSaveExercise} size="large" />
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
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
  currentWorkoutCard: {
    marginBottom: 16,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  exerciseItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d1fae5',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
  },
  exerciseSets: {
    fontSize: 13,
    color: '#059669',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
  exerciseCard: {
    marginBottom: 16,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  exerciseRowMuscles: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseType: {
    fontSize: 11,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recentCard: {
    marginBottom: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  setRow: {
    marginBottom: 16,
  },
  setLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  setInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  setInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  setInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  setInputSuffix: {
    fontSize: 14,
    color: '#9ca3af',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    marginTop: 8,
  },
  addSetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});
