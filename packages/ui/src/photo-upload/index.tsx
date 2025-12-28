// Photo Upload Component
// Uses expo-image-picker to capture and upload photos

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export interface PhotoUploadProps {
  onPhotoSelected: (photoUri: string) => void;
  onPhotoRemoved?: () => void;
  photoUri?: string | null;
  uploading?: boolean;
  uploadProgress?: number;
  error?: string | null;
  aspectRatio?: number; // width / height
  maxSize?: number; // in MB
}

export function PhotoUpload({
  onPhotoSelected,
  onPhotoRemoved,
  photoUri,
  uploading = false,
  uploadProgress = 0,
  error = null,
  aspectRatio = 1,
  maxSize = 10,
}: PhotoUploadProps) {
  const requestPermissions = async () => {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const gallery = await ImagePicker.requestMediaLibraryPermissionsAsync();

    return camera.status === 'granted' && gallery.status === 'granted';
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();

    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Camera and gallery permissions are required to take photos'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [aspectRatio, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // Check file size
      if (asset.fileSize && asset.fileSize > maxSize * 1024 * 1024) {
        Alert.alert('File Too Large', `Please select an image under ${maxSize}MB`);
        return;
      }

      onPhotoSelected(asset.uri);
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();

    if (!hasPermission) {
      Alert.alert('Permission Required', 'Gallery permission is required to select photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [aspectRatio, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // Check file size
      if (asset.fileSize && asset.fileSize > maxSize * 1024 * 1024) {
        Alert.alert('File Too Large', `Please select an image under ${maxSize}MB`);
        return;
      }

      onPhotoSelected(asset.uri);
    }
  };

  const showPickerOptions = () => {
    Alert.alert('Add Photo', 'Choose a photo source', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Gallery', onPress: pickFromGallery },
    ]);
  };

  const removePhoto = () => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: onPhotoRemoved,
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {photoUri ? (
        <View style={[styles.previewContainer, { aspectRatio }]}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />

          {uploading && (
            <View style={styles.uploadOverlay}>
              <View style={styles.uploadProgressContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.uploadProgressText}>
                  Uploading... {Math.round(uploadProgress * 100)}%
                </Text>
              </View>
            </View>
          )}

          {!uploading && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={removePhoto}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle" size={28} color="#ef4444" />
            </TouchableOpacity>
          )}

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning" size={16} color="#fff" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.uploadButton, { aspectRatio }]}
          onPress={showPickerOptions}
          activeOpacity={0.8}
        >
          <View style={styles.uploadButtonContent}>
            <Ionicons name="camera" size={32} color="#9ca3af" />
            <Text style={styles.uploadButtonText}>Add Photo</Text>
            <Text style={styles.uploadButtonSubtext}>
              Take a photo or choose from gallery
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  uploadButton: {
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadButtonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadButtonText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  uploadButtonSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#9ca3af',
  },
  previewContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadProgressContainer: {
    alignItems: 'center',
  },
  uploadProgressText: {
    marginTop: 12,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#fff',
  },
});
