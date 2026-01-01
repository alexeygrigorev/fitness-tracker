import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import { foodApi, mealsApi, mealTemplatesApi } from "../api";
import Modal from "../components/Modal";
import FoodItemForm from "./FoodItemForm";
import MealTemplateForm from "./MealTemplateForm";
import LogMealModal from "./LogMealModal";
import AddFoodWithAIModal from "./AddFoodWithAIModal";
import type { FoodItem, Meal, MealTemplate } from "../types";

type Tab = "meals" | "templates" | "items";

// Helper to safely calculate per-serving values (handles 0 or undefined servingSize)
const calcPerServing = (valuePer100g: number, servingSize: number | undefined): number => {
  if (!servingSize || servingSize <= 0) return 0;
  return Math.round(valuePer100g * servingSize / 100);
};

// Helper to check if dates are the same day
const isSameDay = (date1: Date, date2: Date) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

// Format date for display
const formatDate = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

export default function NutritionPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive active tab from URL path
  const getTabFromPath = (): Tab => {
    const path = location.pathname;
    if (path === '/nutrition/templates') return 'templates';
    if (path === '/nutrition/items') return 'items';
    return 'meals'; // default for /nutrition
  };

  const [activeTab, setActiveTab] = useState<Tab>(getTabFromPath());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync tab with URL changes
  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);

  const handleTabChange = (tab: Tab) => {
    const path = tab === 'meals' ? '/nutrition'
                 : tab === 'templates' ? '/nutrition/templates'
                 : '/nutrition/items';
    navigate(path);
  };

  // Date navigation state
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [showLogMeal, setShowLogMeal] = useState(false);
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showAIAddFood, setShowAIAddFood] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem>();
  const [editingTemplate, setEditingTemplate] = useState<MealTemplate>();
  const [editingMeal, setEditingMeal] = useState<Meal>();

  useEffect(() => {
    Promise.all([mealsApi.getAll(), foodApi.getAll(), mealTemplatesApi.getAll()]).then(([mls, fds, tmpl]) => {
      setMeals(mls);
      setFoodItems(fds);
      setTemplates(tmpl);
      setLoading(false);
    });
  }, []);

  // Filter meals by selected date
  const mealsForDate = meals.filter(meal =>
    isSameDay(new Date(meal.loggedAt), selectedDate)
  );

  // Calculate totals for selected date
  const totals = mealsForDate.reduce((acc, meal) => ({
    calories: acc.calories + meal.totalCalories,
    protein: acc.protein + meal.totalProtein,
    carbs: acc.carbs + meal.totalCarbs,
    fat: acc.fat + meal.totalFat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const handleMealLogged = (meal: Meal) => {
    if (editingMeal) {
      // Update existing meal
      setMeals(prev => prev.map(m => m.id === meal.id ? meal : m));
      setEditingMeal(undefined);
    } else {
      // Add new meal
      setMeals(prev => [meal, ...prev]);
    }
  };

  const handleDeleteMeal = async (id: string) => {
    await mealsApi.delete(id);
    setMeals(prev => prev.filter(m => m.id !== id));
  };

  const handleEditMeal = (meal: Meal) => {
    setEditingMeal(meal);
    setShowLogMeal(true);
  };

  const handleFoodSaved = (food: FoodItem) => {
    setShowFoodForm(false);
    setEditingFood(undefined);
    setFoodItems(prev => {
      const existing = prev.find(f => f.id === food.id);
      return existing
        ? prev.map(f => f.id === food.id ? food : f)
        : [...prev, food];
    });
  };

  const handleAIFoodCreated = (food: FoodItem) => {
    setFoodItems(prev => [...prev, food]);
  };

  const handleDeleteFood = async (id: string) => {
    await foodApi.delete(id);
    setFoodItems(prev => prev.filter(f => f.id !== id));
  };

  const handleTemplateSaved = (template: MealTemplate) => {
    setShowTemplateForm(false);
    setEditingTemplate(undefined);
    setTemplates(prev => {
      const existing = prev.find(t => t.id === template.id);
      return existing
        ? prev.map(t => t.id === template.id ? template : t)
        : [...prev, template];
    });
  };

  const handleDeleteTemplate = async (id: string) => {
    await mealTemplatesApi.delete(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "protein": return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
      case "carb": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300";
      case "fat": return "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
      case "beverage": return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Date navigation handlers
  const goToDate = (daysOffset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + daysOffset);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Check if selected date is today (to disable forward button)
  const isToday = isSameDay(selectedDate, new Date());

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  // Tab labels
  const tabLabels: Record<Tab, string> = {
    meals: "Meals",
    templates: "Templates",
    items: "Items"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nutrition Tracking</h2>
        {activeTab === "meals" && (
          <button
            onClick={() => setShowLogMeal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            + Log Meal
          </button>
        )}
      </div>

      {/* Daily totals - only show on meals tab */}
      {activeTab === "meals" && (
        <>
          {/* Date navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => goToDate(-1)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <button
                onClick={goToToday}
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {formatDate(selectedDate)}
              </button>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <button
              onClick={() => goToDate(1)}
              disabled={isToday}
              className={"p-2 rounded-md transition-colors " + (isToday
                ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Calories</div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{totals.calories}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">/ 2500 goal</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Protein</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{totals.protein}g</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">/ 130g goal</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Carbs</div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{totals.carbs}g</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Fat</div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{totals.fat}g</div>
            </div>
          </div>
        </>
      )}

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {(["meals", "templates", "items"] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={
                "py-2 px-1 border-b-2 font-medium text-sm " +
                (activeTab === tab
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")
              }
            >
              {tabLabels[tab]}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "meals" && (
        <div className="space-y-3">
          {mealsForDate.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No meals logged for {formatDate(selectedDate).toLowerCase()}</p>
              <button
                onClick={() => setShowLogMeal(true)}
                className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Log a meal
              </button>
            </div>
          ) : (
            mealsForDate.map(meal => (
              <div key={meal.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{meal.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                        {meal.mealType.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {meal.foods.map(f => {
                        const food = foodItems.find(fi => fi.id === f.foodId);
                        if (!food) return null;
                        const grams = f.grams ?? ('servings' in (f as any) ? (f as any).servings * food.servingSize : 0);
                        return (
                          <span key={f.foodId} className="inline mr-2">
                            {food.name} ({Math.round(grams)}g)
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{Math.round(meal.totalCalories)} kcal</div>
                    <div className="grid grid-cols-3 gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <div>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{Math.round(meal.totalProtein)}g</span> protein
                      </div>
                      <div>
                        <span className="font-medium">{Math.round(meal.totalCarbs)}g</span> carbs
                      </div>
                      <div>
                        <span className="font-medium">{Math.round(meal.totalFat)}g</span> fat
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditMeal(meal)}
                      className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1"
                      title="Edit meal"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button
                      onClick={() => handleDeleteMeal(meal.id)}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-1"
                      title="Delete meal"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingTemplate(undefined);
                setShowTemplateForm(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              + Create Template
            </button>
          </div>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No meal templates yet. Create your first template for quick meal logging.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(template => {
                const totals = template.foods.reduce((acc, f) => {
                  const food = foodItems.find(fi => fi.id === f.foodId);
                  if (food) {
                    // Handle migration from old 'servings' format to new 'grams' format
                    const grams = f.grams ?? ('servings' in f ? (f as any).servings * food.servingSize : 0);
                    const multiplier = grams / 100;
                    return {
                      calories: acc.calories + food.calories * multiplier,
                      protein: acc.protein + food.protein * multiplier,
                      carbs: acc.carbs + food.carbs * multiplier,
                      fat: acc.fat + food.fat * multiplier
                    };
                  }
                  return acc;
                }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

                return (
                  <div key={template.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{template.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                            {template.category.replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {template.foods.map(f => {
                            const food = foodItems.find(fi => fi.id === f.foodId);
                            if (!food) return null;
                            const grams = f.grams ?? ('servings' in (f as any) ? (f as any).servings * food.servingSize : 0);
                            return (
                              <span key={f.foodId} className="inline mr-2">
                                {food.name} ({Math.round(grams)}g)
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="text-right mr-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{Math.round(totals.calories)} kcal</div>
                        <div className="grid grid-cols-3 gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <div>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">{Math.round(totals.protein)}g</span> protein
                          </div>
                          <div>
                            <span className="font-medium">{Math.round(totals.carbs)}g</span> carbs
                          </div>
                          <div>
                            <span className="font-medium">{Math.round(totals.fat)}g</span> fat
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setShowLogMeal(true)}
                          className="text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 p-1"
                          title="Log meal from template"
                        >
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateForm(true);
                          }}
                          className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1"
                          title="Edit template"
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-1"
                          title="Delete template"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "items" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingFood(undefined);
                setShowFoodForm(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              + Add Food Item
            </button>
            <button
              onClick={() => setShowAIAddFood(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Add with AI
            </button>
          </div>
          {foodItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No food items yet. Add your first food item to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {foodItems.map(food => (
                <div key={food.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{food.name}</span>
                        <span className={"text-xs px-1.5 py-0.5 rounded " + getCategoryColor(food.category)}>
                          {food.category}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        1 serving: {food.servingSize || '-'}g ({food.servingType}, {food.caloriesPerPortion ?? calcPerServing(food.calories, food.servingSize)} kcal)
                      </div>
                      {food.brand && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">{food.brand}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingFood(food);
                          setShowFoodForm(true);
                        }}
                        className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1"
                        title="Edit food"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button
                        onClick={() => handleDeleteFood(food.id)}
                        className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-1"
                        title="Delete food"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Per 100g</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{food.calories}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">{food.protein}g</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{food.carbs}g</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{food.fat}g</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">Per serving ({food.servingSize || '-'}g)</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{food.caloriesPerPortion ?? calcPerServing(food.calories, food.servingSize)}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">{calcPerServing(food.protein, food.servingSize)}g</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{calcPerServing(food.carbs, food.servingSize)}g</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{calcPerServing(food.fat, food.servingSize)}g</div>
                      </div>
                    </div>
                  </div>
                  {(food.glycemicIndex !== undefined || food.absorptionSpeed || food.satietyScore || food.proteinQuality) && (
                    <div className="mt-2 pt-2 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex gap-3">
                      <span>GI: {food.glycemicIndex && food.glycemicIndex > 0 ? food.glycemicIndex : "-"}</span>
                      <span>Absorption: {food.absorptionSpeed || "-"}</span>
                      <span>Satiety: {food.satietyScore ? `${food.satietyScore}/10` : "-"}</span>
                      <span title="Protein quality for muscle building">PQ: {food.proteinQuality ? `${'⭐'.repeat(food.proteinQuality)}` : "-"}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showLogMeal && (
        <LogMealModal
          isOpen={showLogMeal}
          onClose={() => {
            setShowLogMeal(false);
            setEditingMeal(undefined);
          }}
          onMealLogged={handleMealLogged}
          editingMeal={editingMeal}
        />
      )}

      {showFoodForm && (
        <Modal
          isOpen={showFoodForm}
          onClose={() => {
            setShowFoodForm(false);
            setEditingFood(undefined);
          }}
          title={editingFood ? "Edit Food Item" : "Add Food Item"}
        >
          <FoodItemForm
            food={editingFood}
            onSave={handleFoodSaved}
            onCancel={() => {
              setShowFoodForm(false);
              setEditingFood(undefined);
            }}
          />
        </Modal>
      )}

      {showTemplateForm && (
        <Modal
          isOpen={showTemplateForm}
          onClose={() => {
            setShowTemplateForm(false);
            setEditingTemplate(undefined);
          }}
          title={editingTemplate ? "Edit Template" : "Create Template"}
        >
          <MealTemplateForm
            template={editingTemplate}
            onSave={handleTemplateSaved}
            onCancel={() => {
              setShowTemplateForm(false);
              setEditingTemplate(undefined);
            }}
          />
        </Modal>
      )}

      {showAIAddFood && (
        <AddFoodWithAIModal
          isOpen={showAIAddFood}
          onClose={() => setShowAIAddFood(false)}
          onFoodCreated={handleAIFoodCreated}
        />
      )}
    </div>
  );
}
