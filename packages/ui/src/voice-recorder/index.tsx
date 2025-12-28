// Voice Recorder Component
// Uses expo-av to record voice input for hands-free logging

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

export interface VoiceRecorderProps {
  onRecordingComplete: (audioUri: string, duration: number) => void;
  onError?: (error: string) => void;
  maxDuration?: number; // in seconds
}

export function VoiceRecorder({
  onRecordingComplete,
  onError,
  maxDuration = 30,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recording, setRecording] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<any | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }
    })();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const startRecording = async () => {
    if (!hasPermission) {
      onError?.('Microphone permission not granted');
      return;
    }

    try {
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsProcessing(true);
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatus();

      if (uri) {
        onRecordingComplete(uri, status.durationMillis || recordingDuration * 1000);
      }

      setRecording(null);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to stop recording');
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;

    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recording.stopAndUnloadAsync();
      // Delete the recording file
      const uri = recording.getURI();
      if (uri) {
        // File will be cleaned up automatically by expo-av
      }
      setRecording(null);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  };

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="mic-off" size={32} color="#ef4444" />
        <Text style={styles.permissionText}>
          Microphone permission is required for voice recording
        </Text>
      </View>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = recordingDuration / maxDuration;
  const isNearLimit = progress > 0.8;

  return (
    <View style={styles.container}>
      {/* Duration Display */}
      <View style={styles.durationContainer}>
        <Text style={[styles.durationText, isNearLimit && styles.durationTextWarning]}>
          {formatTime(recordingDuration)}
        </Text>
        <Text style={styles.maxDurationText}> / {formatTime(maxDuration)}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            { width: `${Math.min(progress * 100, 100)}%` },
            isNearLimit && styles.progressBarWarning,
          ]}
        />
      </View>

      {/* Recording Indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={[styles.recordingDot, isProcessing && styles.recordingDotInactive]} />
          <Text style={styles.recordingText}>
            {isProcessing ? 'Processing...' : 'Recording...'}
          </Text>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.buttonContainer}>
        {!isRecording && !isProcessing && recordingDuration === 0 && (
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startRecording}
            activeOpacity={0.8}
          >
            <Ionicons name="mic" size={32} color="#fff" />
          </TouchableOpacity>
        )}

        {isRecording && !isProcessing && (
          <>
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={stopRecording}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.cancelButton]}
              onPress={cancelRecording}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {isProcessing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.processingText}>Processing audio...</Text>
          </View>
        )}
      </View>

      {/* Help Text */}
      {!isRecording && !isProcessing && recordingDuration === 0 && (
        <Text style={styles.helpText}>
          Tap the microphone to start recording. Say your workout or meal details.
        </Text>
      )}

      {isRecording && !isProcessing && (
        <Text style={styles.helpText}>
          Speak clearly. Say "check" or "done" when finished, or tap the stop button.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  permissionContainer: {
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  durationText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1f2937',
  },
  durationTextWarning: {
    color: '#ef4444',
  },
  maxDurationText: {
    fontSize: 18,
    color: '#9ca3af',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  progressBarWarning: {
    backgroundColor: '#ef4444',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingDotInactive: {
    backgroundColor: '#9ca3af',
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  stopButton: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    shadowColor: '#6b7280',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  helpText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
});
