// Food Photo Analysis Service
// Handles image capture, upload, and AI-based food recognition

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export interface FoodAnalysisResult {
  foodName: string;
  portionSize: number; // grams
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  category: 'PROTEIN' | 'CARB' | 'FAT' | 'MIXED';
  confidence: number;
  detectedItems: string[];
}

export interface FoodAnalysisResultWithFoods {
  foodName: string;
  portionSize: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  category: 'PROTEIN' | 'CARB' | 'FAT' | 'MIXED';
  confidence: number;
  detectedItems: string[];
  foods?: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
}

export interface ImageUploadResult {
  uri: string;
  width: number;
  height: number;
  size: number; // bytes
}

class FoodPhotoService {
  /**
   * Request camera and library permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return (
        cameraStatus.status === 'granted' && libraryStatus.status === 'granted'
      );
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Pick an image from the photo library
   */
  async pickFromLibrary(): Promise<ImageUploadResult | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Camera and photo library permissions are required');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);

      return {
        uri: asset.uri,
        width: asset.width || 0,
        height: asset.height || 0,
        size: (fileInfo as any).size ? Number((fileInfo as any).size) : 0,
      };
    } catch (error) {
      console.error('Error picking from library:', error);
      throw error;
    }
  }

  /**
   * Take a photo with the camera
   */
  async takePhoto(): Promise<ImageUploadResult | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Camera permission is required');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);

      return {
        uri: asset.uri,
        width: asset.width || 0,
        height: asset.height || 0,
        size: (fileInfo as any).size ? Number((fileInfo as any).size) : 0,
      };
    } catch (error) {
      console.error('Error taking photo:', error);
      throw error;
    }
  }

  /**
   * Compress image if too large
   */
  async compressImage(uri: string, maxSizeMB: number = 5): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSize = (fileInfo as any).size ? Number((fileInfo as any).size) : 0;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      if (fileSize <= maxSizeBytes) {
        return uri; // No compression needed
      }

      // For a real implementation, you would use an image manipulation library
      // For now, just return the original URI
      return uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri;
    }
  }

  /**
   * Convert image to base64
   */
  async imageToBase64(uri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return base64;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  }

  /**
   * Analyze food photo using OpenAI Vision API
   */
  async analyzeFoodPhoto(imageUri: string): Promise<FoodAnalysisResult> {
    return this.analyzePhoto(imageUri);
  }

  /**
   * Alias for analyzeFoodPhoto for compatibility
   */
  async analyzePhoto(imageUri: string): Promise<FoodAnalysisResultWithFoods> {
    try {
      // Compress image if needed
      const compressedUri = await this.compressImage(imageUri, 5);
      const base64Image = await this.imageToBase64(compressedUri);

      // Get MIME type from URI
      const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

      // Call OpenAI Vision API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this food photo and provide detailed nutritional information.

Please identify:
1. All food items visible in the image
2. Estimate portion sizes in grams
3. Calculate approximate calories, protein, carbs, fat for each item
4. Classify each item as PROTEIN, CARB, FAT, or MIXED
5. Estimate your confidence level (0-1)

Respond in JSON format:
{
  "foodName": "Main dish name",
  "detectedItems": ["item 1", "item 2", "item 3"],
  "portionSize": total grams,
  "calories": total calories,
  "protein": grams of protein,
  "carbs": grams of carbs,
  "fat": grams of fat,
  "fiber": grams of fiber (if applicable),
  "category": "PROTEIN" | "CARB" | "FAT" | "MIXED",
  "confidence": 0.0-1.0
}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message || 'Food analysis failed');
      }

      const result = await response.json() as any;
      const analysis = JSON.parse(result.choices?.[0]?.message?.content || '{}');

      return {
        foodName: analysis.foodName || 'Unknown Food',
        portionSize: analysis.portionSize || 0,
        calories: analysis.calories || 0,
        protein: analysis.protein || 0,
        carbs: analysis.carbs || 0,
        fat: analysis.fat || 0,
        fiber: analysis.fiber,
        category: analysis.category || 'MIXED',
        confidence: analysis.confidence || 0.7,
        detectedItems: analysis.detectedItems || [],
        foods: analysis.foods || [{
          name: analysis.foodName || 'Unknown Food',
          calories: analysis.calories || 0,
          protein: analysis.protein || 0,
          carbs: analysis.carbs || 0,
          fat: analysis.fat || 0,
        }],
      };
    } catch (error) {
      console.error('Error analyzing food photo:', error);
      throw error;
    }
  }

  /**
   * Upload image to S3 (for storage and future reference)
   */
  async uploadToS3(
    _uri: string,
    userId: string,
    fileName?: string
  ): Promise<string | null> {
    try {
      // In a real implementation, this would upload to S3 using presigned URLs
      // For now, return the local URI
      const timestamp = Date.now();
      const name = fileName || `food_${timestamp}.jpg`;
      const key = `${userId}/food-photos/${name}`;

      // TODO: Implement S3 upload
      console.log('Would upload to S3:', key);

      return key;
    } catch (error) {
      console.error('Error uploading to S3:', error);
      return null;
    }
  }

  /**
   * Delete a local image file
   */
  async deleteLocalImage(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri);
    } catch (error) {
      console.error('Error deleting local image:', error);
    }
  }
}

// Export singleton instance
export const foodPhotoService = new FoodPhotoService();

// Export a hook for React components
export interface UseFoodPhotoReturn {
  isLoading: boolean;
  error: string | null;
  pickFromLibrary: () => Promise<FoodAnalysisResult | null>;
  takePhoto: () => Promise<FoodAnalysisResult | null>;
}

export function useFoodPhoto(): UseFoodPhotoReturn {
  let isLoading = false;
  let error: string | null = null;

  return {
    isLoading,
    error,
    pickFromLibrary: async () => {
      isLoading = true;
      error = null;
      try {
        const image = await foodPhotoService.pickFromLibrary();
        if (!image) {
          return null;
        }
        const analysis = await foodPhotoService.analyzeFoodPhoto(image.uri);
        return analysis;
      } catch (err) {
        error = (err as Error).message;
        return null;
      } finally {
        isLoading = false;
      }
    },
    takePhoto: async () => {
      isLoading = true;
      error = null;
      try {
        const image = await foodPhotoService.takePhoto();
        if (!image) {
          return null;
        }
        const analysis = await foodPhotoService.analyzeFoodPhoto(image.uri);
        return analysis;
      } catch (err) {
        error = (err as Error).message;
        return null;
      } finally {
        isLoading = false;
      }
    },
  };
}
