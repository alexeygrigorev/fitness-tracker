import { useState, useEffect } from "react";
import { foodApi, mealsApi, mealTemplatesApi } from "../lib/api";
import Modal from "../components/Modal";
import FoodItemForm from "../components/FoodItemForm";
import MealTemplateForm from "../components/MealTemplateForm";
import LogMealModal from "../components/LogMealModal";
import type { FoodItem, Meal, MealTemplate } from "../lib/types";

type Tab = "meals" | "foods" | "templates";

export default function Nutrition() {
  const [activeTab, setActiveTab] = useState<Tab>("meals");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [showLogMeal, setShowLogMeal] = useState(false);
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem>();
  const [editingTemplate, setEditingTemplate] = useState<MealTemplate>();

  useEffect(() => {
    Promise.all([mealsApi.getAll(), foodApi.getAll(), mealTemplatesApi.getAll()]).then(([mls, fds, tmpl]) => {
      setMeals(mls);
      setFoodItems(fds);
      setTemplates(tmpl);
      setLoading(false);
    });
  }, []);

  const totals = meals.reduce((acc, meal) => ({
    calories: acc.calories + meal.totalCalories,
    protein: acc.protein + meal.totalProtein,
    carbs: acc.carbs + meal.totalCarbs,
    fat: acc.fat + meal.totalFat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const handleMealLogged = (meal: Meal) => {
    setMeals(prev => [meal, ...prev]);
  };

  const handleDeleteMeal = async (id: string) => {
    await mealsApi.delete(id);
    setMeals(prev => prev.filter(m => m.id !== id));
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
      case "protein": return "bg-red-100 text-red-700";
      case "carb": return "bg-yellow-100 text-yellow-700";
      case "fat": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Nutrition Tracking</h2>
        <button
          onClick={() => setShowLogMeal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          + Log Meal
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Calories</div>
          <div className="text-xl font-bold text-gray-900">{totals.calories}</div>
          <div className="text-xs text-gray-400">/ 2500 goal</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Protein</div>
          <div className="text-xl font-bold text-blue-600">{totals.protein}g</div>
          <div className="text-xs text-gray-400">/ 130g goal</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Carbs</div>
          <div className="text-xl font-bold text-gray-900">{totals.carbs}g</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Fat</div>
          <div className="text-xl font-bold text-gray-900">{totals.fat}g</div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {(["meals", "foods", "templates"] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={
                "py-2 px-1 border-b-2 font-medium text-sm " +
                (activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500")
              }
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "meals" && (
        <div className="space-y-3">
          {meals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No meals logged yet</p>
              <button
                onClick={() => setShowLogMeal(true)}
                className="mt-2 text-blue-600 hover:text-blue-700"
              >
                Log your first meal
              </button>
            </div>
          ) : (
            meals.map(meal => (
              <div key={meal.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{meal.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                        {meal.mealType.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(meal.loggedAt).toLocaleDateString()} • {meal.foods.length} food items
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <div className="font-medium text-gray-900">{meal.totalCalories} kcal</div>
                    <div className="text-sm text-gray-500">{meal.totalProtein}g protein</div>
                  </div>
                  <button
                    onClick={() => handleDeleteMeal(meal.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "foods" && (
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
          </div>
          {foodItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No food items yet. Add your first food item to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {foodItems.map(food => (
                <div key={food.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{food.name}</span>
                        <span className={"text-xs px-1.5 py-0.5 rounded " + getCategoryColor(food.category)}>
                          {food.category}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {food.servingSize}{food.servingUnit} serving
                      </div>
                      {food.brand && (
                        <div className="text-xs text-gray-400">{food.brand}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingFood(food);
                          setShowFoodForm(true);
                        }}
                        className="text-blue-500 hover:text-blue-700 p-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteFood(food.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Cals</div>
                      <div className="text-sm font-medium">{food.calories}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Protein</div>
                      <div className="text-sm font-medium text-blue-600">{food.protein}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Carbs</div>
                      <div className="text-sm font-medium">{food.carbs}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Fat</div>
                      <div className="text-sm font-medium">{food.fat}g</div>
                    </div>
                  </div>
                  {food.glycemicIndex && (
                    <div className="mt-2 pt-2 border-t text-xs text-gray-500 flex gap-3">
                      <span>GI: {food.glycemicIndex}</span>
                      <span>Absorption: {food.absorptionSpeed}</span>
                      <span>Satiety: {food.satietyScore}/10</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
            <div className="text-center py-8 text-gray-500">
              No meal templates yet. Create your first template for quick meal logging.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(template => {
                const totals = template.foods.reduce((acc, f) => {
                  const food = foodItems.find(fi => fi.id === f.foodId);
                  if (food) {
                    return {
                      calories: acc.calories + food.calories * f.servings,
                      protein: acc.protein + food.protein * f.servings,
                      carbs: acc.carbs + food.carbs * f.servings,
                      fat: acc.fat + food.fat * f.servings
                    };
                  }
                  return acc;
                }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

                return (
                  <div key={template.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{template.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                            {template.category.replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {template.foods.length} food items
                        </div>
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.tags.map(tag => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right mr-4">
                        <div className="font-medium text-gray-900">{Math.round(totals.calories)} kcal</div>
                        <div className="text-sm text-gray-500">{Math.round(totals.protein)}g protein</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setShowLogMeal(true)}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                        >
                          Log Meal
                        </button>
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateForm(true);
                          }}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Delete
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

      {showLogMeal && (
        <LogMealModal
          isOpen={showLogMeal}
          onClose={() => setShowLogMeal(false)}
          onMealLogged={handleMealLogged}
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
    </div>
  );
}
