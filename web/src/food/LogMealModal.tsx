import { useState, useEffect } from 'react';
import { mealsApi, mealTemplatesApi, aiMealApi, foodApi } from '../api';
import FoodSelector from './FoodSelector';
import type { MealTemplate, Meal, MealCategory, MealFoodItem, FoodItem } from '../types';

interface LogMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMealLogged: (meal: Meal) => void;
  onFoodCreated?: (food: FoodItem) => void;
  templateId?: string;
  editingMeal?: Meal;
}

export default function LogMealModal({ isOpen, onClose, onMealLogged, onFoodCreated, templateId, editingMeal }: LogMealModalProps) {
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealCategory>('snack');
  const [foods, setFoods] = useState<MealFoodItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saveAsFoodItem, setSaveAsFoodItem] = useState(false);
  const [showAiSection, setShowAiSection] = useState(false);
  const [aiImages, setAiImages] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false);

  useEffect(() => {
    // Check for speech recognition support
    setHasSpeechSupport('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }, []);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        mealTemplatesApi.getAll(),
        foodApi.getAll()
      ]).then(([templatesData, foodsData]) => {
        setTemplates(templatesData);
        setFoodItems(foodsData);

        // If editing a meal, populate the form
        if (editingMeal) {
          setName(editingMeal.name);
          setMealType(editingMeal.mealType);
          setFoods([...editingMeal.foods]);
          setNotes(editingMeal.notes || '');
          setSelectedTemplate(null);
        } else if (templateId) {
          const t = templatesData.find((tm: MealTemplate) => tm.id === templateId);
          if (t) {
            setSelectedTemplate(t.id);
            setName(t.name);
            setMealType(t.category);
            setFoods([...t.foods]);
          }
        } else {
          // Reset form for new meal
          resetFormInternal();
        }
      });
    }
  }, [isOpen, templateId, editingMeal]);

  const resetFormInternal = () => {
    setName('');
    setMealType('snack');
    setFoods([]);
    setNotes('');
    setSelectedTemplate(null);
    setAiDescription('');
    setSaveAsFoodItem(false);
    setShowAiSection(false);
    setAiImages([]);
    setIsRecording(false);
  };

  const resetForm = () => {
    resetFormInternal();
    onClose();
  };

  // When a template is selected, populate the form
  useEffect(() => {
    const t = templates.find(tm => tm.id === selectedTemplate);
    if (t) {
      setName(t.name);
      setMealType(t.category);
      setFoods([...t.foods]);
    }
  }, [selectedTemplate, templates]);

  const handleAiAnalyze = async () => {
    if (!aiDescription.trim() && aiImages.length === 0) return;
    setAiLoading(true);
    try {
      // For now, we use the text description. Images would be processed by a real AI API
      const result = await aiMealApi.analyzeMeal(aiDescription || 'Meal from photo');
      setName(result.name);
      setMealType(result.mealType);
      setFoods(result.foods);
      setShowAiSection(false);
      setAiDescription('');
      setAiImages([]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files);
      setAiImages(prev => [...prev, ...newImages]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setAiImages(prev => prev.filter((_, i) => i !== index));
  };

  const startDictation = () => {
    if (!hasSpeechSupport) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setAiDescription(prev => prev + finalTranscript);
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();

    // Store reference to stop it later
    (window as any).currentRecognition = recognition;
  };

  const stopDictation = () => {
    if ((window as any).currentRecognition) {
      (window as any).currentRecognition.stop();
      (window as any).currentRecognition = null;
    }
    setIsRecording(false);
  };

  const handleClearTemplate = () => {
    setSelectedTemplate(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || foods.length === 0) return;

    setLoading(true);
    try {
      // Calculate nutrition totals
      const totals = await mealTemplatesApi.calculateNutrition({ foods });

      // If saveAsFoodItem is checked, first save as a new food item
      if (saveAsFoodItem) {
        const totalGrams = foods.reduce((sum, f) => {
          const food = foodItems.find(fi => fi.id === f.foodId);
          return sum + (food?.servingSize || 0);
        }, 0);

        // Create a composite food item from this meal
        const newFoodItem = await foodApi.create({
          name: name.trim(),
          category: 'mixed',
          source: 'user',
          servingSize: totalGrams || 100,
          servingType: 'g',
          calories: Math.round(totals.totalCalories),
          protein: Math.round(totals.totalProtein),
          carbs: Math.round(totals.totalCarbs),
          fat: Math.round(totals.totalFat),
          glycemicIndex: 50,
          absorptionSpeed: 'moderate',
          insulinResponse: 50,
          satietyScore: 7,
          proteinQuality: 2
        });
        onFoodCreated?.(newFoodItem);
      }

      let meal: Meal;

      if (editingMeal) {
        // Update existing meal
        meal = await mealsApi.update(editingMeal.id, {
          name: name.trim(),
          mealType,
          foods,
          notes: notes.trim() || undefined,
        });
        // Recalculate nutrition
        meal = {
          ...meal,
          totalCalories: totals.totalCalories,
          totalProtein: totals.totalProtein,
          totalCarbs: totals.totalCarbs,
          totalFat: totals.totalFat
        };
      } else {
        // Create new meal
        meal = await mealsApi.create({
          name: name.trim(),
          mealType,
          foods,
          loggedAt: new Date(),
          notes: notes.trim() || undefined,
          source: 'ai_assisted'
        });
      }

      onMealLogged(meal);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const NutritionPreview = () => {
    const [totals, setTotals] = useState({ totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });

    useEffect(() => {
      mealTemplatesApi.calculateNutrition({ foods }).then(setTotals);
    }, [foods]);

    return (
      <div className="grid grid-cols-4 gap-2 p-3 bg-gray-50 rounded-md">
        <div className="text-center">
          <div className="text-lg font-bold">{Math.round(totals.totalCalories)}</div>
          <div className="text-xs text-gray-500">kcal</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{Math.round(totals.totalProtein)}g</div>
          <div className="text-xs text-gray-500">protein</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">{Math.round(totals.totalCarbs)}g</div>
          <div className="text-xs text-gray-500">carbs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">{Math.round(totals.totalFat)}g</div>
          <div className="text-xs text-gray-500">fat</div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{editingMeal ? 'Edit Meal' : 'Log Meal'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Quick Actions: Templates and AI */}
          {!editingMeal && (
            <div className="space-y-3">
              {/* Templates */}
              {templates.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Quick add from template</label>
                    {selectedTemplate && (
                      <button
                        type="button"
                        onClick={handleClearTemplate}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTemplate(t.id)}
                        className={"px-3 py-2 text-sm rounded-md border transition-colors " + (selectedTemplate === t.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700')}
                      >
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-gray-500">{t.foods.length} items</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Quick Add */}
              <div>
                {showAiSection ? (
                  <div className="space-y-3 p-3 bg-purple-50 rounded-md border border-purple-200">
                    {/* Text input with dictation */}
                    <div className="relative">
                      <textarea
                        value={aiDescription}
                        onChange={e => setAiDescription(e.target.value)}
                        placeholder="e.g., 'chicken breast with rice and broccoli for lunch' or '2 eggs with bread for breakfast'"
                        rows={2}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                      />
                      {/* Dictation button */}
                      {hasSpeechSupport && (
                        <button
                          type="button"
                          onClick={isRecording ? stopDictation : startDictation}
                          className={"absolute right-2 bottom-2 p-1.5 rounded-full " + (isRecording ? "bg-red-500 text-white animate-pulse" : "bg-gray-200 text-gray-600 hover:bg-gray-300")}
                          title={isRecording ? "Stop dictation" : "Start dictation"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Image upload */}
                    <div>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                          id="ai-image-upload"
                        />
                        <span className="px-3 py-1.5 text-xs text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 cursor-pointer inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Add photos
                        </span>
                      </label>
                    </div>

                    {/* Image previews */}
                    {aiImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {aiImages.map((img, index) => (
                          <div key={index} className="relative">
                            <img
                              src={URL.createObjectURL(img)}
                              alt={`Upload ${index + 1}`}
                              className="w-16 h-16 object-cover rounded-md border"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAiAnalyze}
                        disabled={aiLoading || (!aiDescription.trim() && aiImages.length === 0)}
                        className="flex-1 px-3 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {aiLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Analyze & Fill
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAiSection(false)}
                        className="px-3 py-2 text-sm text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAiSection(true)}
                    className="w-full px-3 py-2 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Quick Add
                  </button>
                )}
              </div>

              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs text-gray-500 text-center">Or manually fill in the form below</p>
              </div>
            </div>
          )}

          {/* Selected template indicator */}
          {selectedTemplate && !editingMeal && (
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-md">
              <span className="text-sm text-blue-700">
                Using template: <strong>{templates.find(t => t.id === selectedTemplate)?.name}</strong>
              </span>
              <button
                type="button"
                onClick={handleClearTemplate}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Change
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meal Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type</label>
            <select
              value={mealType}
              onChange={e => setMealType(e.target.value as MealCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
              <option value="post_workout">Post-Workout</option>
              <option value="beverage">Beverage</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Foods</label>
            <FoodSelector selectedFoods={foods} onChange={setFoods} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Save as Food Item checkbox */}
          {!editingMeal && foods.length > 0 && (
            <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={saveAsFoodItem}
                onChange={e => setSaveAsFoodItem(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="text-sm">
                <span className="font-medium text-gray-700">Save as food item</span>
                <p className="text-gray-500">Save this meal as a reusable food item in your database</p>
              </div>
            </label>
          )}

          <NutritionPreview />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || foods.length === 0}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : (editingMeal ? 'Update Meal' : (saveAsFoodItem ? 'Save & Log Meal' : 'Log Meal'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
