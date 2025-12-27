// ============================================
// Common Types
// ============================================

export type ID = string;

export interface Model {
  id: ID;
  createdAt: Date;
  updatedAt: Date;
}

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Auth & User
// ============================================

export interface User extends Model {
  username: string;
  email: string;
  profile?: UserProfile;
  currentGoal?: Goal;
}

export interface UserProfile extends Model {
  userId: ID;
  weight?: number; // kg
  height?: number; // cm
  birthdate?: Date;
  units: UnitSystem;
  garminConnected: boolean;
}

export enum UnitSystem {
  METRIC = 'METRIC',
  ENGLISH = 'ENGLISH',
}

// ============================================
// Goals
// ============================================

export interface Goal extends Model {
  userId: ID;
  name: string;
  description?: string;
  type: GoalType;
  target: GoalTarget;
  status: GoalStatus;
  startDate: Date;
  targetDate?: Date;
  completedAt?: Date;
}

export enum GoalType {
  WEIGHT_LOSS = 'WEIGHT_LOSS',
  WEIGHT_GAIN = 'WEIGHT_GAIN',
  MAINTENANCE = 'MAINTENANCE',
  MUSCLE_GAIN = 'MUSCLE_GAIN',
  STRENGTH = 'STRENGTH',
  ENDURANCE = 'ENDURANCE',
  HEALTH = 'HEALTH',
}

export interface GoalTarget {
  weight?: number; // kg
  bodyFatPercentage?: number;
  strength?: StrengthTarget;
  activity?: ActivityTarget;
}

export interface StrengthTarget {
  exerciseId: ID;
  targetWeight: number; // kg
  targetReps: number;
}

export interface ActivityTarget {
  workoutsPerWeek?: number;
  caloriesPerDay?: number;
  stepsPerDay?: number;
}

export enum GoalStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

// ============================================
// Exercises Domain
// ============================================

export interface Exercise extends Model {
  name: string;
  owner: string;
  type: ExerciseType;
  equipment?: string;
  movementPattern?: MovementPattern;
  classification: ExerciseClassification;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  stabilizerMuscles?: MuscleGroup[];
  isCanonical: boolean;
}

export enum ExerciseType {
  WEIGHT_BASED = 'WEIGHT_BASED',
  BODYWEIGHT = 'BODYWEIGHT',
  DURATION_BASED = 'DURATION_BASED',
}

export enum MovementPattern {
  PUSH = 'PUSH',
  PULL = 'PULL',
  HINGE = 'HINGE',
  SQUAT = 'SQUAT',
  CARRY = 'CARRY',
  ROTATE = 'ROTATE',
  LUNGE = 'LUNGE',
  GAIT = 'GAIT',
}

export enum ExerciseClassification {
  UPPER_BODY = 'UPPER_BODY',
  LOWER_BODY = 'LOWER_BODY',
  CORE = 'CORE',
  FULL_BODY = 'FULL_BODY',
}

export enum MuscleGroup {
  HEAD_NECK = 'HEAD_NECK',
  CHEST = 'CHEST',
  BACK = 'BACK',
  SHOULDERS = 'SHOULDERS',
  BICEPS = 'BICEPS',
  TRICEPS = 'TRICEPS',
  FOREARMS = 'FOREARMS',
  ABS = 'ABS',
  OBLIQUES = 'OBLIQUES',
  LOWER_BACK = 'LOWER_BACK',
  GLUTES = 'GLUTES',
  QUADS = 'QUADS',
  HAMSTRINGS = 'HAMSTRINGS',
  CALVES = 'CALVES',
  HIP_FLEXORS = 'HIP_FLEXORS',
  ADDUCTORS = 'ADDUCTORS',
  ABDUCTORS = 'ABDUCTORS',
}

export enum BodyRegion {
  UPPER_BODY = 'UPPER_BODY',
  LOWER_BODY = 'LOWER_BODY',
  CORE = 'CORE',
}

// Training Programs
export interface TrainingProgram extends Model {
  userId: ID;
  name: string;
  description?: string;
  status: ProgramStatus;
  isActive: boolean;
  trainingDays: TrainingDay[];
}

export enum ProgramStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export interface TrainingDay extends Model {
  programId: ID;
  program?: TrainingProgram;
  name: string;
  plannedExercises: PlannedExercise[];
  version: number;
  isArchived: boolean;
}

export interface PlannedExercise extends Model {
  trainingDayId: ID;
  trainingDay?: TrainingDay;
  exerciseId: ID;
  exercise?: Exercise;
  targetSets: number;
  targetReps?: number;
  targetDuration?: number; // seconds
  targetWeight?: number; // kg
  notes?: string;
  order: number;
}

// Workout Sessions
export interface WorkoutSession extends Model {
  userId: ID;
  user?: User;
  date: Date;
  startTimestamp: Date;
  endTimestamp?: Date;
  isAutoClosed: boolean;
  trainingDaySnapshot?: TrainingDaySnapshot;
  sessionItems: SessionItem[];
  notes?: string;
  source: SessionSource;
}

export enum SessionSource {
  MANUAL = 'MANUAL',
  AI_ASSISTED = 'AI_ASSISTED',
  DEVICE = 'DEVICE',
}

export interface TrainingDaySnapshot {
  id: ID;
  sessionId: ID;
  name: string;
  plannedExercisesSnapshot: any; // JSON
  capturedAt: Date;
}

export interface SessionItem extends Model {
  sessionId: ID;
  session?: WorkoutSession;
  type: SessionItemType;
  exerciseId?: ID;
  exercise?: Exercise;
  eventTimestamp: Date;
  isEstimated: boolean;
  order: number;
}

export enum SessionItemType {
  EXERCISE_SET = 'EXERCISE_SET',
  WARM_UP = 'WARM_UP',
  MOBILITY = 'MOBILITY',
  STRETCHING = 'STRETCHING',
  OTHER_ACTIVITY = 'OTHER_ACTIVITY',
  REST = 'REST',
}

export interface ExerciseSet extends Model {
  sessionId: ID;
  session?: WorkoutSession;
  sessionItemId: ID;
  sessionItem?: SessionItem;
  exerciseId: ID;
  exercise?: Exercise;
  setType: SetType;
  weight?: number; // kg
  reps?: number;
  duration?: number; // seconds
  endTimestamp: Date;
  startTimestamp: Date;
  isEstimated: boolean;
  rpe?: number; // 1-10
  rir?: number; // 0-10
}

export enum SetType {
  WARM_UP = 'WARM_UP',
  WORKING = 'WORKING',
  DROP_SET = 'DROP_SET',
  FAILURE = 'FAILURE',
}

// ============================================
// Food Domain
// ============================================

export interface FoodItem extends Model {
  name: string;
  owner: string;
  category: FoodCategory;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  glycemicIndex?: number; // 0-100
  absorptionSpeed?: AbsorptionSpeed;
  insulinResponse?: InsulinResponse;
  satietyScore?: number; // 1-10
  isCanonical: boolean;
  source: FoodSource;
  barcode?: string;
}

export enum FoodCategory {
  CARB = 'CARB',
  PROTEIN = 'PROTEIN',
  FAT = 'FAT',
  MIXED = 'MIXED',
}

export enum AbsorptionSpeed {
  FAST = 'FAST',
  MODERATE = 'MODERATE',
  SLOW = 'SLOW',
}

export enum InsulinResponse {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
}

export enum FoodSource {
  MANUAL = 'MANUAL',
  AI_GENERATED = 'AI_GENERATED',
  BARCODE = 'BARCODE',
  DATABASE_IMPORT = 'DATABASE_IMPORT',
}

export interface MealTemplate extends Model {
  userId: ID;
  name: string;
  category: MealCategory;
  ingredients: MealIngredient[];
  tags?: string[];
}

export enum MealCategory {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACK = 'SNACK',
  POST_WORKOUT = 'POST_WORKOUT',
  BEVERAGE = 'BEVERAGE',
}

export interface MealIngredient {
  id: ID;
  mealTemplateId?: ID;
  mealTemplate?: MealTemplate;
  mealInstanceId?: ID;
  mealInstance?: MealInstance;
  foodItemId: ID;
  foodItem?: FoodItem;
  quantity: number; // g
}

export interface MealInstance extends Model {
  userId: ID;
  user?: User;
  timestamp: Date;
  isEstimated: boolean;
  category: MealCategory;
  ingredients: MealIngredient[];
  notes?: string;
  source: SessionSource;
}

// ============================================
// Sleep Domain
// ============================================

export interface SleepSession extends Model {
  userId: ID;
  user?: User;
  date: Date;
  bedtime: Date;
  wakeTime: Date;
  duration: number; // minutes
  deepSleep?: number; // minutes
  lightSleep?: number; // minutes
  remSleep?: number; // minutes
  awakeTime?: number; // minutes
  qualityScore: number; // 1-100
  sleepEfficiency?: number; // percentage
  restingHeartRate?: number; // bpm
  hrv?: number; // ms
  source: SessionSource;
  notes?: string;
}

// ============================================
// Passive Activities
// ============================================

export interface Activity extends Model {
  userId: ID;
  type: ActivityType;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  steps?: number;
  distance?: number; // km
  caloriesBurned?: number;
  averageHeartRate?: number; // bpm
  maxHeartRate?: number; // bpm
  source: ActivitySource;
  deviceId?: string;
  notes?: string;
}

export enum ActivityType {
  WALKING = 'WALKING',
  RUNNING = 'RUNNING',
  CYCLING = 'CYCLING',
  SWIMMING = 'SWIMMING',
  HIKING = 'HIKING',
  STANDING = 'STANDING',
  OTHER = 'OTHER',
}

export enum ActivitySource {
  MANUAL = 'MANUAL',
  DEVICE = 'DEVICE',
  AI_ASSISTED = 'AI_ASSISTED',
}

// ============================================
// Metabolism & Insights
// ============================================

export interface MetabolicState extends Model {
  userId: ID;
  timestamp: Date;
  energyAvailability: EnergyLevel;
  glycogenStatus: GlycogenLevel;
  insulinActivity: InsulinLevel;
  recoveryState: RecoveryLevel;
  fatigueLevel: FatigueLevel;
  factors: any; // JSON
}

export enum EnergyLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

export enum GlycogenLevel {
  DEPLETED = 'DEPLETED',
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  FULL = 'FULL',
}

export enum InsulinLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
}

export enum RecoveryLevel {
  VERY_POOR = 'VERY_POOR',
  POOR = 'POOR',
  MODERATE = 'MODERATE',
  GOOD = 'GOOD',
  EXCELLENT = 'EXCELLENT',
}

export enum FatigueLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

export interface Advice extends Model {
  userId: ID;
  title: string;
  message: string;
  reasoning: string;
  trigger: AdviceTrigger;
  context: any; // JSON
  isRead: boolean;
  isDismissed: boolean;
  isActioned: boolean;
  confidence: number; // 0-1
  createdAt: Date;
  expiresAt?: Date;
}

export enum AdviceTrigger {
  MORNING = 'MORNING',
  PRE_WORKOUT = 'PRE_WORKOUT',
  POST_WORKOUT = 'POST_WORKOUT',
  END_OF_DAY = 'END_OF_DAY',
  POOR_SLEEP = 'POOR_SLEEP',
  LOW_RECOVERY = 'LOW_RECOVERY',
  CALORIE_PACING = 'CALORIE_PACING',
}

// ============================================
// UI Types
// ============================================

export interface Tab {
  name: string;
  icon: string;
  route: string;
}

export interface NavigationProps {
  navigation: any;
  route: any;
}
