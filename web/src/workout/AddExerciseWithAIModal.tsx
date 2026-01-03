import { useState, useRef } from 'react';
import { exercisesApi } from '../api';
import Modal from '../components/Modal';
import type { Exercise } from '../types';

interface AddExerciseWithAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExerciseCreated: (exercise: Exercise) => void;
}

export default function AddExerciseWithAIModal({ isOpen, onClose, onExerciseCreated }: AddExerciseWithAIModalProps) {
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState<'input' | 'review' | 'done'>('input');
  const [analyzedExercise, setAnalyzedExercise] = useState<Partial<Exercise> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (images.length === 0 && !description.trim()) {
      alert('Please add at least one image or a description');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await exercisesApi.analyzeWithAI({ images, description });
      setAnalyzedExercise(result);
      setStep('review');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (analyzedExercise) {
      const exercise = await exercisesApi.create(analyzedExercise as Omit<Exercise, 'id'>);
      onExerciseCreated(exercise);
      handleClose();
    }
  };

  const handleStartOver = () => {
    setImages([]);
    setImagePreviews([]);
    setDescription('');
    setAnalyzedExercise(null);
    setStep('input');
  };

  const handleClose = () => {
    setImages([]);
    setImagePreviews([]);
    setDescription('');
    setAnalyzedExercise(null);
    setStep('input');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Exercise with AI">
      {step === 'input' && (
        <div className="space-y-4">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative w-24 h-24">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
              {imagePreviews.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs mt-1">Add Photo</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>

          {/* Text Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exercise Name or Description
              <span className="text-gray-400 font-normal"> (helps identify the exercise)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Barbell Bench Press, Push-ups, Goblet Squat..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Analyze Button */}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || (images.length === 0 && !description.trim())}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing with AI...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Analyze Exercise with AI
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            AI will identify the exercise and extract details like muscle groups, equipment, and instructions
          </p>
        </div>
      )}

      {step === 'review' && analyzedExercise && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Exercise identified!</span>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">{analyzedExercise.name}</h3>

            <div className="text-sm mb-3">
              <span className="text-gray-500">Category:</span> <span className="capitalize">{analyzedExercise.category}</span>
            </div>

            <div className="text-sm mb-3">
              <span className="text-gray-500">Muscle Groups:</span>
              <div className="capitalize">{analyzedExercise.muscleGroups?.join(', ') || '-'}</div>
            </div>

            <div className="text-sm mb-3">
              <span className="text-gray-500">Equipment:</span>
              <div>{analyzedExercise.equipment || 'Bodyweight'}</div>
            </div>

            {analyzedExercise.instructions && analyzedExercise.instructions.length > 0 && (
              <div className="text-sm">
                <span className="text-gray-500">Instructions:</span>
                <ol className="list-decimal list-inside mt-1">
                  {analyzedExercise.instructions.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleStartOver}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Start Over
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            >
              Add Exercise
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            You can edit this exercise after adding it
          </p>
        </div>
      )}
    </Modal>
  );
}
