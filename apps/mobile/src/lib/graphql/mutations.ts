// GraphQL Mutations
// Auto-generated from schema.graphql or manually written

// ============================================
// Unified AI Lambda Mutations
// ============================================

export const parseWorkout = `
  mutation ParseWorkout($description: String!, $userId: ID!) {
    fitnessAI(action: parseWorkout, input: { description: $description, userId: $userId }) {
      success
      data
      error
      confidence
    }
  }
`;

export const parseFood = `
  mutation ParseFood($description: String!, $userId: ID!) {
    fitnessAI(action: parseFood, input: { description: $description, userId: $userId }) {
      success
      data
      error
      confidence
    }
  }
`;

export const generateAdvice = `
  mutation GenerateAdvice($trigger: String!, $userId: ID!, $userData: AWSJSON) {
    fitnessAI(action: generateAdvice, input: { trigger: $trigger, userId: $userId, userData: $userData }) {
      success
      data
      error
      confidence
    }
  }
`;

export const transcribeVoice = `
  mutation TranscribeVoice($audioUrl: String!, $userId: ID!, $language: String) {
    fitnessAI(action: transcribeVoice, input: { audioUrl: $audioUrl, userId: $userId, language: $language }) {
      success
      data
      error
      confidence
    }
  }
`;

export const analyzeFoodPhoto = `
  mutation AnalyzeFoodPhoto($photoUrl: String!, $userId: ID!) {
    fitnessAI(action: analyzeFoodPhoto, input: { photoUrl: $photoUrl, userId: $userId }) {
      success
      data
      error
      confidence
    }
  }
`;

// ============================================
// User Mutations
// ============================================

export const createUser = `
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      username
      email
      createdAt
      updatedAt
    }
  }
`;

export const updateUser = `
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      username
      email
      createdAt
      updatedAt
    }
  }
`;

export const deleteUser = `
  mutation DeleteUser($input: DeleteUserInput!) {
    deleteUser(input: $input) {
      id
      username
      email
    }
  }
`;

// ============================================
// UserProfile Mutations
// ============================================

export const createUserProfile = `
  mutation CreateUserProfile($input: CreateUserProfileInput!) {
    createUserProfile(input: $input) {
      id
      userId
      weight
      height
      birthdate
      units
      garminConnected
      createdAt
      updatedAt
    }
  }
`;

export const updateUserProfile = `
  mutation UpdateUserProfile($input: UpdateUserProfileInput!) {
    updateUserProfile(input: $input) {
      id
      userId
      weight
      height
      birthdate
      units
      garminConnected
      createdAt
      updatedAt
    }
  }
`;

export const updateUserMetrics = `
  mutation UpdateUserMetrics(
    $id: ID!
    $weight: Float
    $height: Float
  ) {
    updateUserProfile(input: {
      id: $id
      weight: $weight
      height: $height
    }) {
      id
      weight
      height
    }
  }
`;

// ============================================
// Exercise Mutations
// ============================================

export const createExercise = `
  mutation CreateExercise($input: CreateExerciseInput!) {
    createExercise(input: $input) {
      id
      name
      owner
      type
      equipment
      movementPattern
      classification
      primaryMuscles
      secondaryMuscles
      stabilizerMuscles
      isCanonical
      createdAt
      updatedAt
    }
  }
`;

export const updateExercise = `
  mutation UpdateExercise($input: UpdateExerciseInput!) {
    updateExercise(input: $input) {
      id
      name
      type
      equipment
      classification
      primaryMuscles
      updatedAt
    }
  }
`;

export const deleteExercise = `
  mutation DeleteExercise($input: DeleteExerciseInput!) {
    deleteExercise(input: $input) {
      id
      name
    }
  }
`;

// ============================================
// Workout Mutations
// ============================================

export const createWorkoutSession = `
  mutation CreateWorkoutSession($input: CreateWorkoutSessionInput!) {
    createWorkoutSession(input: $input) {
      id
      userId
      date
      startTimestamp
      endTimestamp
      isAutoClosed
      notes
      source
      createdAt
      updatedAt
    }
  }
`;

export const startWorkout = `
  mutation StartWorkout(
    $userId: ID!
    $date: AWSDateTime!
    $notes: String
    $source: SessionSource
  ) {
    createWorkoutSession(input: {
      userId: $userId
      date: $date
      startTimestamp: $date
      notes: $notes
      source: $source
    }) {
      id
      userId
      date
      startTimestamp
      source
    }
  }
`;

export const updateWorkoutSession = `
  mutation UpdateWorkoutSession($input: UpdateWorkoutSessionInput!) {
    updateWorkoutSession(input: $input) {
      id
      userId
      date
      startTimestamp
      endTimestamp
      isAutoClosed
      notes
      source
      createdAt
      updatedAt
    }
  }
`;

export const endWorkout = `
  mutation EndWorkout(
    $id: ID!
    $endTimestamp: AWSDateTime!
    $notes: String
  ) {
    updateWorkoutSession(input: {
      id: $id
      endTimestamp: $endTimestamp
      notes: $notes
    }) {
      id
      endTimestamp
      notes
    }
  }
`;

export const deleteWorkoutSession = `
  mutation DeleteWorkoutSession($input: DeleteWorkoutSessionInput!) {
    deleteWorkoutSession(input: $input) {
      id
      userId
    }
  }
`;

// ============================================
// Session Item & ExerciseSet Mutations
// ============================================

export const createSessionItem = `
  mutation CreateSessionItem($input: CreateSessionItemInput!) {
    createSessionItem(input: $input) {
      id
      sessionId
      type
      exerciseId
      eventTimestamp
      order
      createdAt
    }
  }
`;

export const createExerciseSet = `
  mutation CreateExerciseSet($input: CreateExerciseSetInput!) {
    createExerciseSet(input: $input) {
      id
      sessionId
      sessionItemId
      exerciseId
      setType
      weight
      reps
      duration
      endTimestamp
      startTimestamp
      rpe
      rir
      createdAt
    }
  }
`;

export const addExerciseToWorkout = `
  mutation AddExerciseToWorkout(
    $sessionId: ID!
    $exerciseId: ID!
    $sets: [ExerciseSetInput!]!
    $order: Int!
  ) {
    createSessionItem(input: {
      sessionId: $sessionId
      type: EXERCISE_SET
      exerciseId: $exerciseId
      eventTimestamp: "$now"
      order: $order
    }) {
      id
      exercise {
        id
        name
      }
    }
  }
`;

export const updateExerciseSet = `
  mutation UpdateExerciseSet($input: UpdateExerciseSetInput!) {
    updateExerciseSet(input: $input) {
      id
      weight
      reps
      duration
      rpe
      rir
      updatedAt
    }
  }
`;

export const deleteExerciseSet = `
  mutation DeleteExerciseSet($input: DeleteExerciseSetInput!) {
    deleteExerciseSet(input: $input) {
      id
    }
  }
`;

// ============================================
// Food Mutations
// ============================================

export const createFoodItem = `
  mutation CreateFoodItem($input: CreateFoodItemInput!) {
    createFoodItem(input: $input) {
      id
      name
      category
      caloriesPer100g
      proteinPer100g
      carbsPer100g
      fatPer100g
      fiberPer100g
      isCanonical
      source
      createdAt
      updatedAt
    }
  }
`;

export const updateFoodItem = `
  mutation UpdateFoodItem($input: UpdateFoodItemInput!) {
    updateFoodItem(input: $input) {
      id
      name
      category
      caloriesPer100g
      updatedAt
    }
  }
`;

export const deleteFoodItem = `
  mutation DeleteFoodItem($input: DeleteFoodItemInput!) {
    deleteFoodItem(input: $input) {
      id
      name
    }
  }
`;

// ============================================
// Meal Mutations
// ============================================

export const createMealInstance = `
  mutation CreateMealInstance($input: CreateMealInstanceInput!) {
    createMealInstance(input: $input) {
      id
      userId
      timestamp
      isEstimated
      category
      notes
      source
      ingredients {
        items {
          id
          foodItemId
          quantity
          foodItem {
            id
            name
            caloriesPer100g
            proteinPer100g
            carbsPer100g
            fatPer100g
          }
        }
      }
      createdAt
      updatedAt
    }
  }
`;

export const logMeal = `
  mutation LogMeal(
    $userId: ID!
    $timestamp: AWSDateTime!
    $category: MealCategory!
    $ingredients: [MealIngredientInput!]!
    $notes: String
    $source: SessionSource
    $isEstimated: Boolean
  ) {
    createMealInstance(input: {
      userId: $userId
      timestamp: $timestamp
      category: $category
      ingredients: $ingredients
      notes: $notes
      source: $source
      isEstimated: $isEstimated
    }) {
      id
      timestamp
      category
      ingredients {
        items {
          id
          quantity
          foodItem {
            id
            name
            caloriesPer100g
            proteinPer100g
            carbsPer100g
            fatPer100g
          }
        }
      }
    }
  }
`;

export const updateMealInstance = `
  mutation UpdateMealInstance($input: UpdateMealInstanceInput!) {
    updateMealInstance(input: $input) {
      id
      timestamp
      category
      notes
      updatedAt
    }
  }
`;

export const deleteMealInstance = `
  mutation DeleteMealInstance($input: DeleteMealInstanceInput!) {
    deleteMealInstance(input: $input) {
      id
    }
  }
`;

// ============================================
// MealIngredient Mutations
// ============================================

export const createMealIngredient = `
  mutation CreateMealIngredient($input: CreateMealIngredientInput!) {
    createMealIngredient(input: $input) {
      id
      mealInstanceId
      foodItemId
      quantity
      foodItem {
        id
        name
        caloriesPer100g
        proteinPer100g
        carbsPer100g
        fatPer100g
      }
    }
  }
`;

export const updateMealIngredient = `
  mutation UpdateMealIngredient($input: UpdateMealIngredientInput!) {
    updateMealIngredient(input: $input) {
      id
      quantity
    }
  }
`;

export const deleteMealIngredient = `
  mutation DeleteMealIngredient($input: DeleteMealIngredientInput!) {
    deleteMealIngredient(input: $input) {
      id
    }
  }
`;

// ============================================
// Sleep Mutations
// ============================================

export const createSleepSession = `
  mutation CreateSleepSession($input: CreateSleepSessionInput!) {
    createSleepSession(input: $input) {
      id
      userId
      date
      bedtime
      wakeTime
      duration
      deepSleep
      lightSleep
      remSleep
      awakeTime
      qualityScore
      sleepEfficiency
      restingHeartRate
      hrv
      source
      notes
      createdAt
      updatedAt
    }
  }
`;

export const logSleep = `
  mutation LogSleep(
    $userId: ID!
    $bedtime: AWSDateTime!
    $wakeTime: AWSDateTime!
    $duration: Int!
    $qualityScore: Int!
    $deepSleep: Int
    $lightSleep: Int
    $remSleep: Int
    $awakeTime: Int
    $notes: String
    $source: SessionSource
  ) {
    createSleepSession(input: {
      userId: $userId
      date: $bedtime
      bedtime: $bedtime
      wakeTime: $wakeTime
      duration: $duration
      qualityScore: $qualityScore
      deepSleep: $deepSleep
      lightSleep: $lightSleep
      remSleep: $remSleep
      awakeTime: $awakeTime
      notes: $notes
      source: $source
    }) {
      id
      date
      bedtime
      wakeTime
      duration
      qualityScore
    }
  }
`;

export const updateSleepSession = `
  mutation UpdateSleepSession($input: UpdateSleepSessionInput!) {
    updateSleepSession(input: $input) {
      id
      bedtime
      wakeTime
      duration
      qualityScore
      notes
      updatedAt
    }
  }
`;

export const deleteSleepSession = `
  mutation DeleteSleepSession($input: DeleteSleepSessionInput!) {
    deleteSleepSession(input: $input) {
      id
    }
  }
`;

// ============================================
// Activity Mutations
// ============================================

export const createActivity = `
  mutation CreateActivity($input: CreateActivityInput!) {
    createActivity(input: $input) {
      id
      userId
      type
      startTime
      endTime
      duration
      steps
      distance
      caloriesBurned
      averageHeartRate
      maxHeartRate
      source
      deviceId
      createdAt
    }
  }
`;

export const syncActivity = `
  mutation SyncActivity(
    $userId: ID!
    $type: ActivityType!
    $startTime: AWSDateTime!
    $endTime: AWSDateTime!
    $duration: Int!
    $steps: Int
    $distance: Float
    $caloriesBurned: Int
    $averageHeartRate: Int
    $maxHeartRate: Int
    $deviceId: String
    $notes: String
  ) {
    createActivity(input: {
      userId: $userId
      type: $type
      startTime: $startTime
      endTime: $endTime
      duration: $duration
      steps: $steps
      distance: $distance
      caloriesBurned: $caloriesBurned
      averageHeartRate: $averageHeartRate
      maxHeartRate: $maxHeartRate
      deviceId: $deviceId
      notes: $notes
      source: DEVICE
    }) {
      id
      type
      startTime
      duration
    }
  }
`;

// ============================================
// Goal Mutations
// ============================================

export const createGoal = `
  mutation CreateGoal($input: CreateGoalInput!) {
    createGoal(input: $input) {
      id
      userId
      name
      description
      type
      target
      status
      startDate
      targetDate
      createdAt
      updatedAt
    }
  }
`;

export const updateGoal = `
  mutation UpdateGoal($input: UpdateGoalInput!) {
    updateGoal(input: $input) {
      id
      name
      status
      targetDate
      completedAt
      updatedAt
    }
  }
`;

export const completeGoal = `
  mutation CompleteGoal($id: ID!, $completedAt: AWSDateTime!) {
    updateGoal(input: {
      id: $id
      status: COMPLETED
      completedAt: $completedAt
    }) {
      id
      status
      completedAt
    }
  }
`;

export const deleteGoal = `
  mutation DeleteGoal($input: DeleteGoalInput!) {
    deleteGoal(input: $input) {
      id
    }
  }
`;

// ============================================
// Training Program Mutations
// ============================================

export const createTrainingProgram = `
  mutation CreateTrainingProgram($input: CreateTrainingProgramInput!) {
    createTrainingProgram(input: $input) {
      id
      userId
      name
      description
      status
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const updateTrainingProgram = `
  mutation UpdateTrainingProgram($input: UpdateTrainingProgramInput!) {
    updateTrainingProgram(input: $input) {
      id
      name
      description
      status
      isActive
      updatedAt
    }
  }
`;

export const deleteTrainingProgram = `
  mutation DeleteTrainingProgram($input: DeleteTrainingProgramInput!) {
    deleteTrainingProgram(input: $input) {
      id
    }
  }
`;

// ============================================
// Training Day Mutations
// ============================================

export const createTrainingDay = `
  mutation CreateTrainingDay($input: CreateTrainingDayInput!) {
    createTrainingDay(input: $input) {
      id
      programId
      name
      version
      isArchived
      createdAt
      updatedAt
    }
  }
`;

export const updateTrainingDay = `
  mutation UpdateTrainingDay($input: UpdateTrainingDayInput!) {
    updateTrainingDay(input: $input) {
      id
      name
      version
      isArchived
      updatedAt
    }
  }
`;

export const archiveTrainingDay = `
  mutation ArchiveTrainingDay($id: ID!) {
    updateTrainingDay(input: {
      id: $id
      isArchived: true
    }) {
      id
      isArchived
    }
  }
`;

export const deleteTrainingDay = `
  mutation DeleteTrainingDay($input: DeleteTrainingDayInput!) {
    deleteTrainingDay(input: $input) {
      id
    }
  }
`;

// ============================================
// Planned Exercise Mutations
// ============================================

export const createPlannedExercise = `
  mutation CreatePlannedExercise($input: CreatePlannedExerciseInput!) {
    createPlannedExercise(input: $input) {
      id
      trainingDayId
      exerciseId
      targetSets
      targetReps
      targetDuration
      targetWeight
      notes
      order
      createdAt
    }
  }
`;

export const updatePlannedExercise = `
  mutation UpdatePlannedExercise($input: UpdatePlannedExerciseInput!) {
    updatePlannedExercise(input: $input) {
      id
      targetSets
      targetReps
      targetWeight
      notes
      order
      updatedAt
    }
  }
`;

export const deletePlannedExercise = `
  mutation DeletePlannedExercise($input: DeletePlannedExerciseInput!) {
    deletePlannedExercise(input: $input) {
      id
    }
  }
`;

// ============================================
// MealTemplate Mutations
// ============================================

export const createMealTemplate = `
  mutation CreateMealTemplate($input: CreateMealTemplateInput!) {
    createMealTemplate(input: $input) {
      id
      userId
      name
      category
      tags
      createdAt
      updatedAt
    }
  }
`;

export const updateMealTemplate = `
  mutation UpdateMealTemplate($input: UpdateMealTemplateInput!) {
    updateMealTemplate(input: $input) {
      id
      name
      category
      tags
      updatedAt
    }
  }
`;

export const deleteMealTemplate = `
  mutation DeleteMealTemplate($input: DeleteMealTemplateInput!) {
    deleteMealTemplate(input: $input) {
      id
    }
  }
`;

// ============================================
// Advice Mutations
// ============================================

export const createAdvice = `
  mutation CreateAdvice($input: CreateAdviceInput!) {
    createAdvice(input: $input) {
      id
      userId
      title
      message
      reasoning
      trigger
      context
      isRead
      isDismissed
      isActioned
      confidence
      createdAt
      expiresAt
    }
  }
`;

export const markAdviceAsRead = `
  mutation MarkAdviceAsRead($id: ID!) {
    updateAdvice(input: {
      id: $id
      isRead: true
    }) {
      id
      isRead
    }
  }
`;

export const dismissAdvice = `
  mutation DismissAdvice($id: ID!) {
    updateAdvice(input: {
      id: $id
      isDismissed: true
    }) {
      id
      isDismissed
    }
  }
`;

export const actionAdvice = `
  mutation ActionAdvice($id: ID!) {
    updateAdvice(input: {
      id: $id
      isActioned: true
    }) {
      id
      isActioned
    }
  }
`;

export const deleteAdvice = `
  mutation DeleteAdvice($input: DeleteAdviceInput!) {
    deleteAdvice(input: $input) {
      id
    }
  }
`;

// ============================================
// MetabolicState Mutations
// ============================================

export const createMetabolicState = `
  mutation CreateMetabolicState($input: CreateMetabolicStateInput!) {
    createMetabolicState(input: $input) {
      id
      userId
      timestamp
      energyAvailability
      glycogenStatus
      insulinActivity
      recoveryState
      fatigueLevel
      factors
      createdAt
    }
  }
`;

export const updateMetabolicState = `
  mutation UpdateMetabolicState($input: UpdateMetabolicStateInput!) {
    updateMetabolicState(input: $input) {
      id
      timestamp
      energyAvailability
      glycogenStatus
      insulinActivity
      recoveryState
      fatigueLevel
      factors
      updatedAt
    }
  }
`;

// ============================================
// Garmin Integration Mutations
// ============================================

export const connectGarmin = `
  mutation ConnectGarmin(
    $userProfileId: ID!
    $token: AWSJSON!
  ) {
    updateUserProfile(input: {
      id: $userProfileId
      garminConnected: true
      garminToken: $token
    }) {
      id
      garminConnected
    }
  }
`;

export const disconnectGarmin = `
  mutation DisconnectGarmin($userProfileId: ID!) {
    updateUserProfile(input: {
      id: $userProfileId
      garminConnected: false
      garminToken: null
    }) {
      id
      garminConnected
    }
  }
`;
