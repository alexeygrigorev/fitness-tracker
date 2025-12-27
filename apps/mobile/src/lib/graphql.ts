import { gql } from '@apollo/client';

// Queries
export const GET_USER = gql`
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
      goals {
        items {
          id
          name
          type
          status
          targetDate
        }
      }
    }
  }
`;

export const LIST_WORKOUTS = gql`
  query ListWorkouts($userId: ID!) {
    workoutsByUser(userId: $userId) {
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
            exerciseId
            exercise {
              id
              name
              type
              primaryMuscles
            }
          }
        }
      }
    }
  }
`;

export const LIST_EXERCISES = gql`
  query ListExercises {
    listExercises(limit: 100) {
      items {
        id
        name
        type
        equipment
        movementPattern
        classification
        primaryMuscles
        secondaryMuscles
        isCanonical
      }
    }
  }
`;

export const LIST_MEALS = gql`
  query ListMeals($userId: ID!) {
    mealsByUser(userId: $userId) {
      items {
        id
        timestamp
        category
        notes
        source
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
  }
`;

export const LIST_FOOD_ITEMS = gql`
  query ListFoodItems {
    listFoods(limit: 100) {
      items {
        id
        name
        category
        caloriesPer100g
        proteinPer100g
        carbsPer100g
        fatPer100g
        fiberPer100g
        isCanonical
      }
    }
  }
`;

export const LIST_SLEEP_SESSIONS = gql`
  query ListSleepSessions($userId: ID!) {
    sleepSessionsByUser(userId: $userId) {
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
        source
      }
    }
  }
`;

export const LIST_ADVICE = gql`
  query ListAdvice($userId: ID!) {
    adviceByUser(userId: $userId) {
      items {
        id
        title
        message
        reasoning
        trigger
        isRead
        isDismissed
        createdAt
      }
    }
  }
`;

export const GET_METABOLIC_STATE = gql`
  query GetMetabolicState($userId: ID!) {
    metabolicStatesByUser(userId: $userId) {
      items {
        id
        timestamp
        energyAvailability
        glycogenStatus
        insulinActivity
        recoveryState
        fatigueLevel
      }
    }
  }
`;

// Mutations
export const CREATE_WORKOUT_SESSION = gql`
  mutation CreateWorkoutSession($input: CreateWorkoutSessionInput!) {
    createWorkoutSession(input: $input) {
      id
      date
      startTimestamp
    }
  }
`;

export const CREATE_EXERCISE_SET = gql`
  mutation CreateExerciseSet($input: CreateExerciseSetInput!) {
    createExerciseSet(input: $input) {
      id
      weight
      reps
      rpe
    }
  }
`;

export const CREATE_MEAL = gql`
  mutation CreateMeal($input: CreateMealInstanceInput!) {
    createMealInstance(input: $input) {
      id
      timestamp
      category
    }
  }
`;

export const CREATE_MEAL_INGREDIENT = gql`
  mutation CreateMealIngredient($input: CreateMealIngredientInput!) {
    createMealIngredient(input: $input) {
      id
      quantity
    }
  }
`;

export const CREATE_SLEEP_SESSION = gql`
  mutation CreateSleepSession($input: CreateSleepSessionInput!) {
    createSleepSession(input: $input) {
      id
      date
      duration
      qualityScore
    }
  }
`;

export const UPDATE_USER_PROFILE = gql`
  mutation UpdateUserProfile($input: UpdateUserProfileInput!) {
    updateUserProfile(input: $input) {
      id
      weight
      height
      units
    }
  }
`;

export const CREATE_GOAL = gql`
  mutation CreateGoal($input: CreateGoalInput!) {
    createGoal(input: $input) {
      id
      name
      type
      status
      targetDate
    }
  }
`;

export const MARK_ADVICE_READ = gql`
  mutation MarkAdviceRead($input: UpdateAdviceInput!) {
    updateAdvice(input: $input) {
      id
      isRead
    }
  }
`;

// Subscriptions
export const ON_ADVICE_CREATED = gql`
  subscription OnAdviceCreated($userId: ID!) {
    onAdviceCreated(userId: $userId) {
      id
      title
      message
      reasoning
      trigger
      createdAt
    }
  }
`;

export const ON_WORKOUT_UPDATE = gql`
  subscription OnWorkoutUpdate($userId: ID!) {
    onWorkoutUpdate(userId: $userId) {
      id
      date
      startTimestamp
      endTimestamp
    }
  }
`;
