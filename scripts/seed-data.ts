/**
 * Seed data script for LocalStack DynamoDB
 * Populates tables with canonical exercises and foods
 */

import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
const region = 'eu-west-1';

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    endpoint: LOCALSTACK_ENDPOINT,
    region,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  })
);

// Canonical exercises
const exercises = [
  {
    id: 'ex_001',
    name: 'Bench Press',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['CHEST'],
    secondaryMuscles: ['TRICEPS', 'FRONT_DELTS'],
    equipment: 'Barbell',
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 'ex_002',
    name: 'Squat',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['QUADS'],
    secondaryMuscles: ['GLUTES', 'HAMSTRINGS', 'CORE'],
    equipment: 'Barbell',
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 'ex_003',
    name: 'Deadlift',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['BACK', 'HAMSTRINGS'],
    secondaryMuscles: ['GLUTES', 'CORE'],
    equipment: 'Barbell',
    difficulty: 'ADVANCED',
  },
  {
    id: 'ex_004',
    name: 'Overhead Press',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['SHOULDERS'],
    secondaryMuscles: ['TRICEPS', 'CORE'],
    equipment: 'Barbell',
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 'ex_005',
    name: 'Barbell Row',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['BACK', 'LATS'],
    secondaryMuscles: ['BICEPS', 'REAR_DELTS'],
    equipment: 'Barbell',
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 'ex_006',
    name: 'Pull Up',
    type: 'BODYWEIGHT',
    primaryMuscles: ['LATS', 'UPPER_BACK'],
    secondaryMuscles: ['BICEPS', 'FOREARMS'],
    equipment: null,
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 'ex_007',
    name: 'Push Up',
    type: 'BODYWEIGHT',
    primaryMuscles: ['CHEST', 'TRICEPS'],
    secondaryMuscles: ['FRONT_DELTS', 'CORE'],
    equipment: null,
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_008',
    name: 'Dip',
    type: 'BODYWEIGHT',
    primaryMuscles: ['TRICEPS', 'CHEST'],
    secondaryMuscles: ['FRONT_DELTS'],
    equipment: 'Parallel Bars',
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 'ex_009',
    name: 'Lunge',
    type: 'BODYWEIGHT',
    primaryMuscles: ['QUADS', 'GLUTES'],
    secondaryMuscles: ['HAMSTRINGS', 'CORE'],
    equipment: null,
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_010',
    name: 'Plank',
    type: 'DURATION_BASED',
    primaryMuscles: ['CORE', 'ABS'],
    secondaryMuscles: ['LOWER_BACK', 'SHOULDERS'],
    equipment: null,
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_011',
    name: 'Leg Press',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['QUADS', 'GLUTES'],
    secondaryMuscles: ['HAMSTRINGS'],
    equipment: 'Machine',
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_012',
    name: 'Lat Pulldown',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['LATS'],
    secondaryMuscles: ['BICEPS', 'REAR_DELTS'],
    equipment: 'Cable',
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_013',
    name: 'Bicep Curl',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['BICEPS'],
    secondaryMuscles: ['FOREARMS'],
    equipment: 'Dumbbell',
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_014',
    name: 'Tricep Extension',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['TRICEPS'],
    secondaryMuscles: ['FOREARMS'],
    equipment: 'Cable',
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_015',
    name: 'Leg Curl',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['HAMSTRINGS'],
    secondaryMuscles: ['GLUTES'],
    equipment: 'Machine',
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_016',
    name: 'Calf Raise',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['CALVES'],
    secondaryMuscles: [],
    equipment: 'Machine',
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_017',
    name: 'Crunch',
    type: 'BODYWEIGHT',
    primaryMuscles: ['ABS'],
    secondaryMuscles: ['CORE'],
    equipment: null,
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_018',
    name: 'Russian Twist',
    type: 'BODYWEIGHT',
    primaryMuscles: ['OBLIQUES', 'CORE'],
    secondaryMuscles: ['ABS'],
    equipment: null,
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 'ex_019',
    name: 'Face Pull',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['REAR_DELTS', 'TRAPS'],
    secondaryMuscles: ['ROTATOR_CUFF'],
    equipment: 'Cable',
    difficulty: 'BEGINNER',
  },
  {
    id: 'ex_020',
    name: 'Hip Thrust',
    type: 'WEIGHT_BASED',
    primaryMuscles: ['GLUTES'],
    secondaryMuscles: ['HAMSTRINGS', 'QUADS'],
    equipment: 'Barbell',
    difficulty: 'INTERMEDIATE',
  },
];

// Canonical foods
const foods = [
  { id: 'fd_001', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, category: 'PROTEIN', servingSize: '100g' },
  { id: 'fd_002', name: 'Turkey Breast', calories: 135, protein: 30, carbs: 0, fat: 1, fiber: 0, category: 'PROTEIN', servingSize: '100g' },
  { id: 'fd_003', name: 'Salmon', calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, category: 'PROTEIN', servingSize: '100g' },
  { id: 'fd_004', name: 'Tuna', calories: 132, protein: 28, carbs: 0, fat: 1, fiber: 0, category: 'PROTEIN', servingSize: '100g' },
  { id: 'fd_005', name: 'Eggs', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, category: 'PROTEIN', servingSize: '100g' },
  { id: 'fd_006', name: 'Greek Yogurt', calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0, category: 'PROTEIN', servingSize: '100g' },
  { id: 'fd_007', name: 'Cottage Cheese', calories: 98, protein: 11, carbs: 3.4, fat: 4.3, fiber: 0, category: 'PROTEIN', servingSize: '100g' },
  { id: 'fd_008', name: 'Whey Protein', calories: 370, protein: 78, carbs: 6, fat: 2, fiber: 0, category: 'PROTEIN', servingSize: '100g' },
  { id: 'fd_009', name: 'Brown Rice', calories: 112, protein: 2.6, carbs: 24, fat: 0.9, fiber: 1.8, category: 'CARB', servingSize: '100g' },
  { id: 'fd_010', name: 'Oats', calories: 389, protein: 17, carbs: 66, fat: 7, fiber: 10, category: 'CARB', servingSize: '100g' },
  { id: 'fd_011', name: 'Sweet Potato', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, category: 'CARB', servingSize: '100g' },
  { id: 'fd_012', name: 'Quinoa', calories: 120, protein: 4.4, carbs: 21, fat: 1.9, fiber: 2.8, category: 'CARB', servingSize: '100g' },
  { id: 'fd_013', name: 'Banana', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, category: 'CARB', servingSize: '100g' },
  { id: 'fd_014', name: 'Apple', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, category: 'CARB', servingSize: '100g' },
  { id: 'fd_015', name: 'Broccoli', calories: 55, protein: 3.7, carbs: 11, fat: 0.6, fiber: 2.6, category: 'VEG', servingSize: '100g' },
  { id: 'fd_016', name: 'Spinach', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, category: 'VEG', servingSize: '100g' },
  { id: 'fd_017', name: 'Almonds', calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12, category: 'FAT', servingSize: '100g' },
  { id: 'fd_018', name: 'Peanut Butter', calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, category: 'FAT', servingSize: '100g' },
  { id: 'fd_019', name: 'Avocado', calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, category: 'FAT', servingSize: '100g' },
  { id: 'fd_020', name: 'Olive Oil', calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, category: 'FAT', servingSize: '100g' },
];

async function seedExercises() {
  console.log('Seeding exercises...');
  for (const exercise of exercises) {
    await client.send(new PutCommand({
      TableName: 'CanonicalExercise',
      Item: { ...exercise, pk: `EXERCISE#${exercise.id}`, sk: `#METADATA` },
    }));
  }
  console.log(`✅ Seeded ${exercises.length} exercises`);
}

async function seedFoods() {
  console.log('Seeding foods...');
  for (const food of foods) {
    await client.send(new PutCommand({
      TableName: 'CanonicalFood',
      Item: { ...food, pk: `FOOD#${food.id}`, sk: `#METADATA` },
    }));
  }
  console.log(`✅ Seeded ${foods.length} foods`);
}

async function seed() {
  console.log('🌱 Starting seed...\n');

  await seedExercises();
  await seedFoods();

  console.log('\n✅ Seed complete!');
}

seed().catch(console.error);
