import type { Exercise, WorkoutSession, FoodItem, Meal, SleepEntry, MetabolismState, Advice, MealTemplate } from './types';

const d = Date.now();
const day = 86400000;

export const mockExercises: Exercise[] = [
  {id:'ex1',name:'Barbell Bench Press',category:'compound',muscleGroups:['chest','triceps','shoulders'],equipment:['barbell','bench'],difficulty:'intermediate',instructions:['Lie flat on bench','Grip bar wider than shoulders','Lower to mid-chest','Press up']},
  {id:'ex2',name:'Barbell Squat',category:'compound',muscleGroups:['quads','glutes','hamstrings'],equipment:['barbell','rack'],difficulty:'intermediate',instructions:['Position bar on back','Squat to parallel','Drive through heels']},
  {id:'ex3',name:'Deadlift',category:'compound',muscleGroups:['back','glutes','hamstrings'],equipment:['barbell'],difficulty:'advanced',instructions:['Stand feet hip-width','Grip bar outside legs','Drive through heels']},
  {id:'ex4',name:'Pull-up',category:'compound',muscleGroups:['back','biceps'],equipment:['bar'],difficulty:'intermediate',instructions:['Hang from bar','Pull chin over bar','Lower with control']},
  {id:'ex5',name:'Overhead Press',category:'compound',muscleGroups:['shoulders','triceps'],equipment:['barbell','rack'],difficulty:'intermediate',instructions:['Press bar overhead','Lower to shoulders']},
  {id:'ex6',name:'Dumbbell Curl',category:'isolation',muscleGroups:['biceps'],equipment:['dumbbells'],difficulty:'beginner',instructions:['Curl dumbbell to shoulder','Lower with control']},
  {id:'ex7',name:'Tricep Pushdown',category:'isolation',muscleGroups:['triceps'],equipment:['cable'],difficulty:'beginner',instructions:['Push cable down','Return slowly']},
  {id:'ex8',name:'Running',category:'cardio',muscleGroups:['quads','hamstrings','calves'],equipment:[],difficulty:'beginner',instructions:['Run at pace','Breathe steady']}
];

export const mockFoodItems: FoodItem[] = [
  {id:'food1',name:'Chicken Breast',category:'protein',source:'canonical',servingSize:100,servingUnit:'g',calories:165,protein:31,carbs:0,fat:3.6,fiber:0,glycemicIndex:0,absorptionSpeed:'slow',insulinResponse:10,satietyScore:8},
  {id:'food2',name:'Brown Rice',category:'carb',source:'canonical',servingSize:100,servingUnit:'g',calories:123,protein:2.6,carbs:25.6,fat:1,fiber:1.8,glycemicIndex:68,absorptionSpeed:'moderate',insulinResponse:65,satietyScore:6},
  {id:'food3',name:'Broccoli',category:'mixed',source:'canonical',servingSize:100,servingUnit:'g',calories:34,protein:2.8,carbs:7,fat:0.4,fiber:2.6,glycemicIndex:10,absorptionSpeed:'slow',insulinResponse:5,satietyScore:7},
  {id:'food4',name:'Eggs',category:'protein',source:'canonical',servingSize:1,servingUnit:'large',calories:78,protein:6,carbs:0.6,fat:5,fiber:0,glycemicIndex:0,absorptionSpeed:'moderate',insulinResponse:15,satietyScore:8},
  {id:'food5',name:'Oats',category:'carb',source:'canonical',servingSize:100,servingUnit:'g',calories:389,protein:16.9,carbs:66,fat:6.9,fiber:10.6,glycemicIndex:55,absorptionSpeed:'slow',insulinResponse:50,satietyScore:9},
  {id:'food6',name:'Greek Yogurt',category:'protein',source:'canonical',servingSize:170,servingUnit:'g',calories:100,protein:17,carbs:6,fat:0.7,fiber:0,glycemicIndex:11,absorptionSpeed:'moderate',insulinResponse:20,satietyScore:7},
  {id:'food7',name:'Banana',category:'carb',source:'canonical',servingSize:1,servingUnit:'medium',calories:105,protein:1.3,carbs:27,fat:0.4,fiber:3.1,glycemicIndex:51,absorptionSpeed:'fast',insulinResponse:60,satietyScore:5},
  {id:'food8',name:'Salmon',category:'protein',source:'canonical',servingSize:100,servingUnit:'g',calories:208,protein:20,carbs:0,fat:13,fiber:0,glycemicIndex:0,absorptionSpeed:'moderate',insulinResponse:10,satietyScore:9},
  {id:'food9',name:'Almonds',category:'fat',source:'canonical',servingSize:28,servingUnit:'g',calories:164,protein:6,carbs:6,fat:14,fiber:3.5,glycemicIndex:0,absorptionSpeed:'slow',insulinResponse:5,satietyScore:8},
  {id:'food10',name:'Sweet Potato',category:'carb',source:'canonical',servingSize:100,servingUnit:'g',calories:86,protein:1.6,carbs:20,fat:0.1,fiber:3,glycemicIndex:45,absorptionSpeed:'moderate',insulinResponse:50,satietyScore:7},
  {id:'food11',name:'Whey Protein',category:'protein',source:'canonical',servingSize:30,servingUnit:'g',calories:120,protein:24,carbs:3,fat:1,fiber:0,glycemicIndex:30,absorptionSpeed:'fast',insulinResponse:70,satietyScore:6},
  {id:'food12',name:'Avocado',category:'fat',source:'canonical',servingSize:100,servingUnit:'g',calories:160,protein:2,carbs:9,fat:15,fiber:7,glycemicIndex:15,absorptionSpeed:'slow',insulinResponse:10,satietyScore:9},
  {id:'food13',name:'White Rice',category:'carb',source:'canonical',servingSize:100,servingUnit:'g',calories:130,protein:2.7,carbs:28,fat:0.3,fiber:0.4,glycemicIndex:73,absorptionSpeed:'fast',insulinResponse:75,satietyScore:4},
  {id:'food14',name:'Pasta',category:'carb',source:'canonical',servingSize:100,servingUnit:'g',calories:131,protein:5,carbs:25,fat:1.1,fiber:1.5,glycemicIndex:50,absorptionSpeed:'moderate',insulinResponse:55,satietyScore:5},
  {id:'food15',name:'Olive Oil',category:'fat',source:'canonical',servingSize:15,servingUnit:'ml',calories:120,protein:0,carbs:0,fat:14,fiber:0,glycemicIndex:0,absorptionSpeed:'slow',insulinResponse:0,satietyScore:3}
];

export const mockMealTemplates: MealTemplate[] = [
  {id:'mt1',name:'Protein Bowl',category:'lunch',foods:[{foodId:'food1',servings:1.5},{foodId:'food2',servings:1},{foodId:'food3',servings:1}],tags:['high protein','quick']},
  {id:'mt2',name:'Overnight Oats',category:'breakfast',foods:[{foodId:'food5',servings:0.8},{foodId:'food6',servings:1},{foodId:'food7',servings:1}],tags:['vegetarian','meal prep']},
  {id:'mt3',name:'Post-Workout Shake',category:'post_workout',foods:[{foodId:'food11',servings:1},{foodId:'food7',servings:1},{foodId:'food6',servings:0.5}],tags:['quick','recovery']},
  {id:'mt4',name:'Salmon Dinner',category:'dinner',foods:[{foodId:'food8',servings:1},{foodId:'food10',servings:1.5},{foodId:'food3',servings:1}],tags:['healthy fats','omega-3']}
];

export const mockWorkoutSessions: WorkoutSession[] = [
  {id:'ws1',name:'Upper Body A',startedAt:new Date(d-2*day),endedAt:new Date(d-2*day+3600000),sets:[
    {id:'set1',exerciseId:'ex1',setType:'warmup',weight:45,reps:10,loggedAt:new Date(d-2*day)},
    {id:'set2',exerciseId:'ex1',setType:'normal',weight:135,reps:8,rpe:7,loggedAt:new Date(d-2*day+600000)},
    {id:'set3',exerciseId:'ex1',setType:'normal',weight:135,reps:8,rpe:8,loggedAt:new Date(d-2*day+720000)},
    {id:'set4',exerciseId:'ex5',setType:'normal',weight:95,reps:6,rpe:8,loggedAt:new Date(d-2*day+1200000)}
  ],notes:'Felt strong',totalVolume:2520,estimatedRecovery:48},
  {id:'ws2',name:'Lower Body A',startedAt:new Date(d-day),endedAt:new Date(d-day+4200000),sets:[
    {id:'set5',exerciseId:'ex2',setType:'warmup',weight:95,reps:8,loggedAt:new Date(d-day)},
    {id:'set6',exerciseId:'ex2',setType:'normal',weight:185,reps:5,rpe:7,loggedAt:new Date(d-day+600000)},
    {id:'set7',exerciseId:'ex2',setType:'normal',weight:185,reps:5,rpe:8,loggedAt:new Date(d-day+720000)},
    {id:'set8',exerciseId:'ex2',setType:'normal',weight:185,reps:5,rpe:9,loggedAt:new Date(d-day+840000)},
    {id:'set9',exerciseId:'ex3',setType:'normal',weight:225,reps:5,rpe:8,loggedAt:new Date(d-day+1500000)}
  ],totalVolume:2830,estimatedRecovery:72}
];

export const mockMeals: Meal[] = [
  {id:'meal1',name:'Overnight Oats',mealType:'breakfast',foods:[{foodId:'food5',servings:0.8},{foodId:'food4',servings:2},{foodId:'food6',servings:1}],loggedAt:new Date(d-day+3600000),totalCalories:521,totalProtein:32,totalCarbs:62,totalFat:16,source:'manual'},
  {id:'meal2',name:'Protein Bowl',mealType:'lunch',foods:[{foodId:'food1',servings:1.5},{foodId:'food2',servings:1},{foodId:'food3',servings:1}],loggedAt:new Date(d-day+43200000),totalCalories:431,totalProtein:49,totalCarbs:33,totalFat:6,source:'manual'},
  {id:'meal3',name:'Salmon Dinner',mealType:'dinner',foods:[{foodId:'food8',servings:1},{foodId:'food10',servings:1.5}],loggedAt:new Date(d-day+64800000),totalCalories:337,totalProtein:22,totalCarbs:30,totalFat:13,source:'manual'},
  {id:'meal4',name:'Afternoon Snack',mealType:'snack',foods:[{foodId:'food7',servings:1},{foodId:'food9',servings:1}],loggedAt:new Date(d-day+54000000),totalCalories:269,totalProtein:7,totalCarbs:33,totalFat:14,source:'manual'}
];

export const mockSleepEntries: SleepEntry[] = [
  {id:'sleep1',bedTime:new Date(d-day-32400000),wakeTime:new Date(d-day-7200000),quality:4,deepSleepHours:1.5,remSleepHours:2,lightSleepHours:3.5,awakeHours:0.5,source:'manual',loggedAt:new Date(d-day)},
  {id:'sleep2',bedTime:new Date(d-32400000),wakeTime:new Date(d-7200000),quality:3,deepSleepHours:1,remSleepHours:1.8,lightSleepHours:4,awakeHours:1.2,source:'manual',loggedAt:new Date(d)}
];

export const mockMetabolismStates: MetabolismState[] = [
  {id:'meta1',date:new Date(d-day),energyAvailability:'optimal',glycogenStatus:'moderate',insulinActivity:'moderate',recoveryStatus:'good'},
  {id:'meta2',date:new Date(d),energyAvailability:'low',glycogenStatus:'low',insulinActivity:'low',recoveryStatus:'fair'}
];

export const mockAdvice: Advice[] = [
  {id:'adv1',type:'morning',priority:'high',title:'Prioritize Recovery',message:'Your recovery status is fair today. Consider a lighter workout.',reasoning:'Based on sleep quality (3/5) and recent intense lower body workout.',createdAt:new Date(d-3600000),acknowledged:false},
  {id:'adv2',type:'end_of_day',priority:'medium',title:'Increase Protein',message:'You are 20g below protein goal today.',reasoning:'Current protein is 110g vs goal of 130g.',createdAt:new Date(d),acknowledged:false},
  {id:'adv3',type:'post_workout',priority:'medium',title:'Glycogen Replenishment',message:'Consume carbs within 2 hours post-workout.',reasoning:'Glycogen status is low after lower body session.',createdAt:new Date(d-day+15000000),acknowledged:true}
];
