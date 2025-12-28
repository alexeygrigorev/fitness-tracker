import type { Exercise, WorkoutSession, FoodItem, Meal, SleepEntry, MetabolismState, Advice, MealTemplate, WorkoutProgram, WorkoutPreset } from './types';

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
  {id:'ex8',name:'Running Intervals',category:'cardio',muscleGroups:['quads','hamstrings','calves'],equipment:[],difficulty:'intermediate',instructions:['Warm up with light jog','Alternate 30s sprint with 90s jog','Cool down with light jog']},
  {id:'ex9',name:'Running Recovery',category:'cardio',muscleGroups:['quads','hamstrings','calves'],equipment:[],difficulty:'beginner',instructions:['Keep easy conversational pace','Focus on staying relaxed','Use for active recovery']},
  {id:'ex10',name:'Running Long',category:'cardio',muscleGroups:['quads','hamstrings','calves'],equipment:[],difficulty:'intermediate',instructions:['Maintain steady pace','Stay hydrated','Focus on breathing']}
];

export const mockFoodItems: FoodItem[] = [
  {id:'food1',name:'Chicken Breast',category:'protein',source:'canonical',servingSize:100,servingType:'100g',calories:165,caloriesPerPortion:165,protein:31,carbs:0,fat:3.6,saturatedFat:1,fiber:0,glycemicIndex:0,absorptionSpeed:'slow',insulinResponse:10,satietyScore:8,proteinQuality:3},
  {id:'food2',name:'Brown Rice',category:'carb',source:'canonical',servingSize:100,servingType:'100g cooked',calories:123,caloriesPerPortion:123,protein:2.6,carbs:25.6,fat:1,saturatedFat:0.2,sugar:0.5,fiber:1.8,glycemicIndex:68,absorptionSpeed:'moderate',insulinResponse:65,satietyScore:6,proteinQuality:2},
  {id:'food3',name:'Broccoli',category:'mixed',source:'canonical',servingSize:100,servingType:'100g',calories:34,caloriesPerPortion:34,protein:2.8,carbs:7,fat:0.4,saturatedFat:0,sugar:1.5,fiber:2.6,glycemicIndex:10,absorptionSpeed:'slow',insulinResponse:5,satietyScore:7,proteinQuality:2},
  {id:'food4',name:'Eggs',category:'protein',source:'canonical',servingSize:50,servingType:'1 large egg',calories:143,caloriesPerPortion:72,protein:6.3,carbs:0.6,fat:9.5,saturatedFat:3.3,sugar:0.6,fiber:0,glycemicIndex:0,absorptionSpeed:'moderate',insulinResponse:15,satietyScore:8,proteinQuality:3},
  {id:'food5',name:'Oats',category:'carb',source:'canonical',servingSize:100,servingType:'100g dry',calories:389,caloriesPerPortion:389,protein:16.9,carbs:66,fat:6.9,saturatedFat:1.2,sugar:1,fiber:10.6,glycemicIndex:55,absorptionSpeed:'slow',insulinResponse:50,satietyScore:9,proteinQuality:2},
  {id:'food6',name:'Greek Yogurt',category:'protein',source:'canonical',servingSize:170,servingType:'1 cup (170g)',calories:100,caloriesPerPortion:170,protein:17,carbs:6,fat:0.7,saturatedFat:0.5,sugar:4,fiber:0,glycemicIndex:11,absorptionSpeed:'moderate',insulinResponse:20,satietyScore:7,proteinQuality:3},
  {id:'food7',name:'Banana',category:'carb',source:'canonical',servingSize:120,servingType:'1 medium banana',calories:89,caloriesPerPortion:107,protein:1.1,carbs:22.8,fat:0.3,saturatedFat:0.1,sugar:12.2,fiber:2.6,glycemicIndex:51,absorptionSpeed:'fast',insulinResponse:60,satietyScore:5,proteinQuality:1},
  {id:'food8',name:'Salmon',category:'protein',source:'canonical',servingSize:100,servingType:'100g fillet',calories:208,caloriesPerPortion:208,protein:20,carbs:0,fat:13,saturatedFat:3.2,fiber:0,glycemicIndex:0,absorptionSpeed:'moderate',insulinResponse:10,satietyScore:9,proteinQuality:3},
  {id:'food9',name:'Almonds',category:'fat',source:'canonical',servingSize:28,servingType:'small handful (28g)',calories:164,caloriesPerPortion:46,protein:6,carbs:6,fat:14,saturatedFat:1.1,sugar:1.2,fiber:3.5,glycemicIndex:0,absorptionSpeed:'slow',insulinResponse:5,satietyScore:8,proteinQuality:2},
  {id:'food10',name:'Sweet Potato',category:'carb',source:'canonical',servingSize:350,servingType:'4 pieces',calories:86,caloriesPerPortion:301,protein:1.6,carbs:20,fat:0.1,saturatedFat:0,sugar:4.2,fiber:3,glycemicIndex:45,absorptionSpeed:'moderate',insulinResponse:50,satietyScore:7,proteinQuality:1},
  {id:'food11',name:'Whey Protein',category:'protein',source:'canonical',servingSize:30,servingType:'1 scoop (30g)',calories:120,caloriesPerPortion:36,protein:24,carbs:3,fat:1,saturatedFat:0.5,sugar:1,fiber:0,glycemicIndex:30,absorptionSpeed:'fast',insulinResponse:70,satietyScore:6,proteinQuality:3},
  {id:'food12',name:'Avocado',category:'fat',source:'canonical',servingSize:100,servingType:'1 half avocado',calories:160,caloriesPerPortion:160,protein:2,carbs:9,fat:15,saturatedFat:2.2,sugar:0.3,fiber:7,glycemicIndex:15,absorptionSpeed:'slow',insulinResponse:10,satietyScore:9,proteinQuality:1},
  {id:'food13',name:'White Rice',category:'carb',source:'canonical',servingSize:100,servingType:'100g cooked',calories:130,caloriesPerPortion:130,protein:2.7,carbs:28,fat:0.3,saturatedFat:0.1,sugar:0.1,fiber:0.4,glycemicIndex:73,absorptionSpeed:'fast',insulinResponse:75,satietyScore:4,proteinQuality:1},
  {id:'food14',name:'Pasta',category:'carb',source:'canonical',servingSize:100,servingType:'100g cooked',calories:131,caloriesPerPortion:131,protein:5,carbs:25,fat:1.1,saturatedFat:0.2,sugar:1.5,fiber:1.5,glycemicIndex:50,absorptionSpeed:'moderate',insulinResponse:55,satietyScore:5,proteinQuality:2},
  {id:'food15',name:'Olive Oil',category:'fat',source:'canonical',servingSize:15,servingType:'1 tbsp (15ml)',calories:120,caloriesPerPortion:18,protein:0,carbs:0,fat:14,saturatedFat:2,fiber:0,glycemicIndex:0,absorptionSpeed:'slow',insulinResponse:0,satietyScore:3},
  // Porridge ingredients
  {id:'food16',name:'Oatmeal',category:'carb',source:'canonical',servingSize:50,servingType:'50g dry',calories:389,caloriesPerPortion:195,protein:16.9,carbs:66,fat:6.9,saturatedFat:1.4,sugar:1,fiber:10.6,glycemicIndex:55,absorptionSpeed:'slow',insulinResponse:55,satietyScore:8,proteinQuality:2},
  {id:'food17',name:'Flax Seeds',category:'fat',source:'canonical',servingSize:10,servingType:'1 tbsp (10g)',calories:534,caloriesPerPortion:53,protein:18,carbs:29,fat:42,saturatedFat:3.6,sugar:1.5,fiber:27,glycemicIndex:0,absorptionSpeed:'slow',insulinResponse:5,satietyScore:9,proteinQuality:2},
  {id:'food18',name:'Raisins',category:'carb',source:'canonical',servingSize:15,servingType:'1 tbsp (15g)',calories:299,caloriesPerPortion:45,protein:3.3,carbs:79,fat:0.5,saturatedFat:0.1,sugar:59,fiber:4,glycemicIndex:64,absorptionSpeed:'fast',insulinResponse:70,satietyScore:5,proteinQuality:1},
  // Gainer ingredients
  {id:'food19',name:'Cottage Cheese',category:'protein',source:'canonical',servingSize:200,servingType:'1 cup (200g)',calories:98,caloriesPerPortion:196,protein:11,carbs:3.4,fat:4.3,saturatedFat:2.7,sugar:2.5,fiber:0,glycemicIndex:0,absorptionSpeed:'slow',insulinResponse:15,satietyScore:8,proteinQuality:3},
  {id:'food20',name:'Wheat Flour',category:'carb',source:'canonical',servingSize:50,servingType:'50g',calories:364,caloriesPerPortion:182,protein:10.3,carbs:76.3,fat:1,saturatedFat:0.2,sugar:0.3,fiber:2.7,glycemicIndex:70,absorptionSpeed:'fast',insulinResponse:72,satietyScore:4,proteinQuality:2},
  {id:'food21',name:'Maltodextrin',category:'carb',source:'canonical',servingSize:50,servingType:'50g',calories:380,caloriesPerPortion:190,protein:0,carbs:95,fat:0,saturatedFat:0,sugar:95,fiber:0,glycemicIndex:110,absorptionSpeed:'fast',insulinResponse:85,satietyScore:2},
  {id:'food22',name:'Nesquik',category:'carb',source:'canonical',servingSize:44,servingType:'1 sachet (44g)',calories:378,caloriesPerPortion:166,protein:8.7,carbs:74.6,fat:3,saturatedFat:1.8,sugar:65,fiber:0,glycemicIndex:65,absorptionSpeed:'fast',insulinResponse:75,satietyScore:5,proteinQuality:2},
  // Other foods
  {id:'food23',name:'Potato',category:'carb',source:'canonical',servingSize:350,servingType:'4 pieces',calories:77,caloriesPerPortion:270,protein:2,carbs:17.5,fat:0.4,saturatedFat:0.1,sugar:0.8,fiber:2.2,glycemicIndex:60,absorptionSpeed:'moderate',insulinResponse:60,satietyScore:6,proteinQuality:1},
  {id:'food24',name:'Bread',category:'carb',source:'canonical',servingSize:56,servingType:'2 slices',calories:265,caloriesPerPortion:148,protein:9,carbs:49,fat:3.4,saturatedFat:0.7,sugar:4.3,fiber:2.5,glycemicIndex:70,absorptionSpeed:'fast',insulinResponse:68,satietyScore:5,proteinQuality:2},
  {id:'food25',name:'Cheese',category:'fat',source:'canonical',servingSize:30,servingType:'1 slice (30g)',calories:113,caloriesPerPortion:34,protein:7,carbs:0.1,fat:9,saturatedFat:6,sugar:0.1,fiber:0,glycemicIndex:0,absorptionSpeed:'slow',insulinResponse:10,satietyScore:9,proteinQuality:3},
  {id:'food26',name:'Berry Drink',category:'beverage',source:'canonical',servingSize:500,servingType:'1 bottle (500ml)',calories:52,caloriesPerPortion:260,protein:3.6,carbs:11.2,fat:0,fiber:0,glycemicIndex:50,absorptionSpeed:'fast',insulinResponse:55,satietyScore:4,proteinQuality:2},
  {id:'food27',name:'Chocolate Drink',category:'beverage',source:'canonical',servingSize:500,servingType:'1 bottle (500ml)',calories:68,caloriesPerPortion:340,protein:3.3,carbs:11.7,fat:1.3,saturatedFat:0.8,sugar:10.5,fiber:0,glycemicIndex:55,absorptionSpeed:'fast',insulinResponse:58,satietyScore:4,proteinQuality:2},
  {id:'food28',name:'Pizza Margherita',category:'mixed',source:'canonical',servingSize:120,servingType:'1 slice (120g)',calories:266,caloriesPerPortion:319,protein:11,carbs:33,fat:10,saturatedFat:4.5,sugar:2,fiber:1.5,glycemicIndex:60,absorptionSpeed:'moderate',insulinResponse:65,satietyScore:6,proteinQuality:3}
];

export const mockMealTemplates: MealTemplate[] = [
  {id:'mt1',name:'Protein Bowl',category:'lunch',foods:[{foodId:'food1',grams:150},{foodId:'food2',grams:100},{foodId:'food3',grams:100}]},
  {id:'mt2',name:'Overnight Oats',category:'breakfast',foods:[{foodId:'food5',grams:80},{foodId:'food6',grams:170},{foodId:'food7',grams:120}]},
  {id:'mt3',name:'Post-Workout Shake',category:'post_workout',foods:[{foodId:'food11',grams:30},{foodId:'food7',grams:120},{foodId:'food6',grams:85}]},
  {id:'mt4',name:'Salmon Dinner',category:'dinner',foods:[{foodId:'food8',grams:100},{foodId:'food10',grams:525},{foodId:'food3',grams:100}]}
];

export const mockWorkoutPrograms: WorkoutProgram[] = [
  {
    id:'wp1',
    name:'Push Pull Legs',
    description:'A classic 3-day split focusing on push movements (chest, shoulders, triceps), pull movements (back, biceps), and legs.',
    durationWeeks:8,
    sessionsPerWeek:3,
    exercises:['ex1','ex5','ex7','ex4','ex6','ex2','ex3']
  },
  {
    id:'wp2',
    name:'5x5 Stronglifts',
    description:'A beginner strength program focusing on compound movements with linear progression.',
    durationWeeks:12,
    sessionsPerWeek:3,
    exercises:['ex1','ex2','ex3','ex5','ex4']
  },
  {
    id:'wp3',
    name:'Upper/Lower Split',
    description:'A 4-day split alternating between upper and lower body workouts.',
    durationWeeks:8,
    sessionsPerWeek:4,
    exercises:['ex1','ex4','ex5','ex6','ex7','ex2','ex3']
  },
  {
    id:'wp4',
    name:'Full Body 3x',
    description:'A full body workout program performed 3 times per week, ideal for beginners.',
    durationWeeks:6,
    sessionsPerWeek:3,
    exercises:['ex1','ex2','ex3','ex4','ex5']
  }
];

export const mockWorkoutPresets: WorkoutPreset[] = [
  {
    id:'preset1',
    name:'Upper Body A',
    dayLabel:'Monday',
    exercises:[
      {id:'p1e1', exerciseId:'ex1', type:'normal', sets:4},
      {id:'p1e2', exerciseId:'ex5', type:'normal', sets:4},
      {id:'p1e3', exerciseId:'ex7', type:'normal', sets:3},
      {id:'p1e4', exerciseId:'ex4', type:'dropdown', sets:3, dropdowns: 2}
    ],
    tags:['strength'],
    status:'active'
  },
  {
    id:'preset2',
    name:'Lower Body A',
    dayLabel:'Tuesday',
    exercises:[
      {id:'p2e1', exerciseId:'ex2', type:'normal', sets:5},
      {id:'p2e2', exerciseId:'ex3', type:'normal', sets:3}
    ],
    tags:['strength'],
    status:'active'
  },
  {
    id:'preset3',
    name:'Upper Body B',
    dayLabel:'Thursday',
    exercises:[
      {id:'p3e1', exerciseId:'ex4', type:'normal', sets:4},
      {id:'p3e2', exerciseId:'ex6', type:'normal', sets:3},
      {id:'p3e3', exerciseId:'ex1', type:'dropdown', sets:3, dropdowns: 2},
      {id:'p3e4', exerciseId:'ex5', type:'normal', sets:3}
    ],
    tags:['strength'],
    status:'active'
  },
  {
    id:'preset4',
    name:'Lower Body B',
    dayLabel:'Friday',
    exercises:[
      {id:'p4e1', exerciseId:'ex3', type:'normal', sets:4},
      {id:'p4e2', exerciseId:'ex2', type:'normal', sets:4}
    ],
    tags:['strength'],
    status:'active'
  },
  {
    id:'preset5',
    name:'Push Day',
    dayLabel:'Monday',
    exercises:[
      {id:'p5e1', exerciseId:'ex1', type:'dropdown', sets:4, dropdowns: 2},
      {id:'p5e2', exerciseId:'ex5', type:'normal', sets:4},
      {id:'p5e3', exerciseId:'ex7', type:'normal', sets:3}
    ],
    tags:['strength'],
    status:'active'
  },
  {
    id:'preset6',
    name:'Pull Day',
    dayLabel:'Wednesday',
    exercises:[
      {id:'p6e1', exerciseId:'ex4', type:'normal', sets:4},
      {id:'p6e2', exerciseId:'ex6', type:'normal', sets:4}
    ],
    tags:['strength'],
    status:'active'
  },
  {
    id:'preset7',
    name:'Legs Day',
    dayLabel:'Friday',
    exercises:[
      {id:'p7e1', exerciseId:'ex2', type:'normal', sets:5},
      {id:'p7e2', exerciseId:'ex3', type:'dropdown', sets:3, dropdowns: 2}
    ],
    tags:['strength'],
    status:'active'
  },
  {
    id:'preset8',
    name:'Running Intervals',
    dayLabel:'Wednesday',
    exercises:[
      {id:'p8e1', exerciseId:'ex8', type:'normal', sets:8}
    ],
    tags:['cardio'],
    status:'active'
  },
  {
    id:'preset9',
    name:'Running Recovery',
    dayLabel:'Sunday',
    exercises:[
      {id:'p9e1', exerciseId:'ex9', type:'normal', sets:1}
    ],
    tags:['cardio'],
    status:'active'
  },
  {
    id:'preset10',
    name:'Running Long',
    dayLabel:'Saturday',
    exercises:[
      {id:'p10e1', exerciseId:'ex10', type:'normal', sets:1}
    ],
    tags:['cardio'],
    status:'active'
  }
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
  {id:'meal1',name:'Overnight Oats',mealType:'breakfast',foods:[{foodId:'food5',grams:80},{foodId:'food4',grams:100},{foodId:'food6',grams:170}],loggedAt:new Date(d-day+3600000),totalCalories:521,totalProtein:32,totalCarbs:62,totalFat:16,source:'manual'},
  {id:'meal2',name:'Protein Bowl',mealType:'lunch',foods:[{foodId:'food1',grams:150},{foodId:'food2',grams:100},{foodId:'food3',grams:100}],loggedAt:new Date(d-day+43200000),totalCalories:431,totalProtein:49,totalCarbs:33,totalFat:6,source:'manual'},
  {id:'meal3',name:'Salmon Dinner',mealType:'dinner',foods:[{foodId:'food8',grams:100},{foodId:'food10',grams:525}],loggedAt:new Date(d-day+64800000),totalCalories:337,totalProtein:22,totalCarbs:30,totalFat:13,source:'manual'},
  {id:'meal4',name:'Afternoon Snack',mealType:'snack',foods:[{foodId:'food7',grams:120},{foodId:'food9',grams:28}],loggedAt:new Date(d-day+54000000),totalCalories:269,totalProtein:7,totalCarbs:33,totalFat:14,source:'manual'}
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
