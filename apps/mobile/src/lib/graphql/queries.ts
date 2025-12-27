// GraphQL Queries
// Auto-generated from schema.graphql or manually written

// ============================================
// User Queries
// ============================================

export const getUser = `
  query GetUser($id: ID!) {
    getUser(id: $id) {
      id
      username
      email
      createdAt
      updatedAt
      profile {
        id
        weight
        height
        birthdate
        units
        garminConnected
      }
      currentGoal {
        id
        name
        type
        status
        target
      }
    }
  }
`;

export const listUsers = `
  query ListUsers(
    $limit: Int
    $nextToken: String
  ) {
    listUsers(limit: $limit, nextToken: $nextToken) {
      items {
        id
        username
        email
        createdAt
      }
      nextToken
    }
  }
`;

// ============================================
// Exercise Queries
// ============================================

export const getExercise = `
  query GetExercise($id: ID!) {
    getExercise(id: $id) {
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

export const listExercises = `
  query ListExercises(
    $filter: ModelExerciseFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listExercises(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        name
        owner
        type
        equipment
        movementPattern
        classification
        primaryMuscles
        isCanonical
      }
      nextToken
    }
  }
`;

export const exercisesByMuscleGroup = `
  query ExercisesByMuscleGroup(
    $primaryMuscles: MuscleGroup
    $limit: Int
    $nextToken: String
  ) {
    listExercises(
      filter: {
        primaryMuscles: { contains: $primaryMuscles }
        isCanonical: { eq: true }
      }
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        name
        type
        classification
        primaryMuscles
        equipment
      }
      nextToken
    }
  }
`;

// ============================================
// Workout Queries
// ============================================

export const getWorkoutSession = `
  query GetWorkoutSession($id: ID!) {
    getWorkoutSession(id: $id) {
      id
      userId
      date
      startTimestamp
      endTimestamp
      isAutoClosed
      notes
      source
      sessionItems {
        items {
          id
          type
          exerciseId
          eventTimestamp
          order
          exercise {
            id
            name
            type
          }
        }
        nextToken
      }
      trainingDaySnapshot {
        id
        name
        plannedExercisesSnapshot
      }
      createdAt
      updatedAt
    }
  }
`;

export const workoutSessionsByUser = `
  query WorkoutSessionsByUser(
    $userId: ID!
    $startDate: AWSDateTime
    $endDate: AWSDateTime
    $limit: Int
    $nextToken: String
  ) {
    workoutSessionsByUser(
      userId: $userId
      sortDirection: DESC
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        date
        startTimestamp
        endTimestamp
        notes
        source
        sessionItems {
          items {
            id
            type
          }
        }
        createdAt
      }
      nextToken
    }
  }
`;

export const workoutSessionsByDate = `
  query WorkoutSessionsByDate(
    $userId: ID!
    $date: AWSDateTime!
  ) {
    listWorkoutSessions(
      filter: {
        userId: { eq: $userId }
        date: { eq: $date }
      }
    ) {
      items {
        id
        startTimestamp
        endTimestamp
        notes
        source
      }
    }
  }
`;

// ============================================
// Food Queries
// ============================================

export const getFoodItem = `
  query GetFoodItem($id: ID!) {
    getFoodItem(id: $id) {
      id
      name
      owner
      category
      caloriesPer100g
      proteinPer100g
      carbsPer100g
      fatPer100g
      fiberPer100g
      glycemicIndex
      absorptionSpeed
      insulinResponse
      satietyScore
      isCanonical
      source
      barcode
      createdAt
      updatedAt
    }
  }
`;

export const listFoodItems = `
  query ListFoodItems(
    $filter: ModelFoodItemFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listFoodItems(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        name
        category
        caloriesPer100g
        proteinPer100g
        carbsPer100g
        fatPer100g
        isCanonical
      }
      nextToken
    }
  }
`;

export const searchFoodItems = `
  query SearchFoodItems($name: String!) {
    listFoodItems(
      filter: {
        or: [
          { name: { contains: $name } }
          { isCanonical: { eq: true } }
        ]
      }
      limit: 20
    ) {
      items {
        id
        name
        category
        caloriesPer100g
        proteinPer100g
        carbsPer100g
        fatPer100g
        fiberPer100g
      }
    }
  }
`;

export const getMealInstance = `
  query GetMealInstance($id: ID!) {
    getMealInstance(id: $id) {
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
        nextToken
      }
      createdAt
      updatedAt
    }
  }
`;

export const mealsByUser = `
  query MealsByUser(
    $userId: ID!
    $startDate: AWSDateTime
    $endDate: AWSDateTime
    $limit: Int
    $nextToken: String
  ) {
    mealInstancesByUser(
      userId: $userId
      sortDirection: DESC
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        timestamp
        category
        isEstimated
        notes
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
        createdAt
      }
      nextToken
    }
  }
`;

export const getTodaysMeals = `
  query GetTodaysMeals(
    $userId: ID!
    $startOfDay: AWSDateTime!
    $endOfDay: AWSDateTime!
  ) {
    mealInstancesByUser(
      userId: $userId
      sortDirection: DESC
    ) {
      items {
        id
        timestamp
        category
        isEstimated
        notes
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
        createdAt
      }
    }
  }
`;

// ============================================
// Sleep Queries
// ============================================

export const getSleepSession = `
  query GetSleepSession($id: ID!) {
    getSleepSession(id: $id) {
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

export const sleepSessionsByUser = `
  query SleepSessionsByUser(
    $userId: ID!
    $limit: Int
    $nextToken: String
  ) {
    sleepSessionsByUser(
      userId: $userId
      sortDirection: DESC
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        date
        bedtime
        wakeTime
        duration
        deepSleep
        lightSleep
        remSleep
        qualityScore
        sleepEfficiency
        source
        createdAt
      }
      nextToken
    }
  }
`;

export const getLastNightSleep = `
  query GetLastNightSleep($userId: ID!) {
    sleepSessionsByUser(
      userId: $userId
      sortDirection: DESC
      limit: 1
    ) {
      items {
        id
        date
        bedtime
        wakeTime
        duration
        deepSleep
        lightSleep
        remSleep
        qualityScore
      }
    }
  }
`;

// ============================================
// Activity Queries
// ============================================

export const getActivities = `
  query GetActivities(
    $userId: ID!
    $startDate: AWSDateTime
    $endDate: AWSDateTime
    $limit: Int
  ) {
    activitiesByUser(
      userId: $userId
      sortDirection: DESC
      limit: $limit
    ) {
      items {
        id
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
      nextToken
    }
  }
`;

// ============================================
// Metabolism & Insights Queries
// ============================================

export const getCurrentMetabolicState = `
  query GetCurrentMetabolicState($userId: ID!) {
    metabolicStatesByUser(
      userId: $userId
      sortDirection: DESC
      limit: 1
    ) {
      items {
        id
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
  }
`;

export const getAdvice = `
  query GetAdvice(
    $userId: ID!
    $limit: Int
  ) {
    adviceByUser(
      userId: $userId
      sortDirection: DESC
      limit: $limit
    ) {
      items {
        id
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
      nextToken
    }
  }
`;

export const getUnreadAdvice = `
  query GetUnreadAdvice($userId: ID!) {
    adviceByUser(
      userId: $userId
      sortDirection: DESC
    ) {
      items {
        id
        title
        message
        reasoning
        trigger
        context
        isRead
        isDismissed
        confidence
        createdAt
        expiresAt
      }
    }
  }
`;

// ============================================
// Goal Queries
// ============================================

export const getGoals = `
  query GetGoals($userId: ID!) {
    goalsByUser(userId: $userId) {
      items {
        id
        name
        description
        type
        target
        status
        startDate
        targetDate
        completedAt
        createdAt
      }
    }
  }
`;

export const getActiveGoals = `
  query GetActiveGoals($userId: ID!) {
    goalsByUser(userId: $userId) {
      items {
        id
        name
        description
        type
        target
        status
        startDate
        targetDate
        createdAt
      }
    }
  }
`;

// ============================================
// Training Program Queries
// ============================================

export const getTrainingPrograms = `
  query GetTrainingPrograms($userId: ID!) {
    trainingProgramsByUser(userId: $userId) {
      items {
        id
        name
        description
        status
        isActive
        trainingDays {
          items {
            id
            name
            version
            isArchived
          }
        }
        createdAt
        updatedAt
      }
    }
  }
`;

export const getTrainingDay = `
  query GetTrainingDay($id: ID!) {
    getTrainingDay(id: $id) {
      id
      programId
      name
      version
      isArchived
      plannedExercises {
        items {
          id
          exerciseId
          targetSets
          targetReps
          targetDuration
          targetWeight
          notes
          order
          exercise {
            id
            name
            type
          }
        }
        nextToken
      }
      createdAt
      updatedAt
    }
  }
`;

// ============================================
// Subscription Queries
// ============================================

export const onUpdateAdvice = `
  subscription OnUpdateAdvice($userId: ID!) {
    onUpdateAdvice(filter: { userId: { eq: $userId } }) {
      id
      title
      message
      reasoning
      trigger
      context
      isRead
      isDismissed
      confidence
      createdAt
      expiresAt
    }
  }
`;

export const onCreateWorkoutSession = `
  subscription OnCreateWorkoutSession($userId: ID!) {
    onCreateWorkoutSession(filter: { userId: { eq: $userId } }) {
      id
      date
      startTimestamp
      endTimestamp
      notes
      source
    }
  }
`;
