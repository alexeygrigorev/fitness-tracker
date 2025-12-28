// Voice Recording Service
// Handles audio recording and transcription using OpenAI Whisper API

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface VoiceRecordingResult {
  transcript: string;
  duration: number;
  confidence: number;
}

export interface VoiceRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  duration: number;
  error: string | null;
}

class VoiceService {
  private recording: Audio.Recording | null = null;
  private audioUri: string | null = null;
  private recordingStartTime: number = 0;
  private durationTimer: NodeJS.Timeout | null = null;
  private stateCallback: ((state: VoiceRecordingState) => void) | null = null;

  /**
   * Request necessary permissions for audio recording
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  /**
   * Set up audio mode for recording
   */
  private async setupAudioMode(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
  }

  /**
   * Start recording audio
   */
  async startRecording(
    onStateChange?: (state: VoiceRecordingState) => void
  ): Promise<boolean> {
    try {
      // Check permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      // Setup audio mode
      await this.setupAudioMode();

      // Create new recording
      this.recording = new Audio.Recording();
      this.stateCallback = onStateChange || null;

      // Configure recording
      const recordingSettings = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
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
      };

      // Start recording
      await this.recording.prepareToRecordAsync(recordingSettings);
      await this.recording.startAsync();

      this.recordingStartTime = Date.now();
      this.audioUri = this.recording.getURI() || null;

      // Start duration timer
      this.durationTimer = setInterval(() => {
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        this.notifyState({
          isRecording: true,
          isProcessing: false,
          duration,
          error: null,
        });
      }, 100) as unknown as NodeJS.Timeout;

      this.notifyState({
        isRecording: true,
        isProcessing: false,
        duration: 0,
        error: null,
      });

      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      this.notifyState({
        isRecording: false,
        isProcessing: false,
        duration: 0,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Stop recording and return the audio file info
   */
  async stopRecording(): Promise<{ uri: string | null; duration: number }> {
    try {
      if (!this.recording) {
        throw new Error('No active recording');
      }

      // Stop the recording
      await this.recording.stopAndUnloadAsync();
      const duration = (Date.now() - this.recordingStartTime) / 1000;

      // Clear timer
      if (this.durationTimer) {
        clearInterval(this.durationTimer);
        this.durationTimer = null;
      }

      // Get the recording URI
      const uri = this.recording.getURI() || this.audioUri;

      // Reset recording
      this.recording = null;

      this.notifyState({
        isRecording: false,
        isProcessing: false,
        duration,
        error: null,
      });

      return { uri, duration };
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.notifyState({
        isRecording: false,
        isProcessing: false,
        duration: 0,
        error: (error as Error).message,
      });
      return { uri: null, duration: 0 };
    }
  }

  /**
   * Cancel current recording
   */
  async cancelRecording(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }

      if (this.durationTimer) {
        clearInterval(this.durationTimer);
        this.durationTimer = null;
      }

      // Delete the audio file if it exists
      if (this.audioUri) {
        try {
          await FileSystem.deleteAsync(this.audioUri);
        } catch {
          // File might not exist
        }
        this.audioUri = null;
      }

      this.notifyState({
        isRecording: false,
        isProcessing: false,
        duration: 0,
        error: null,
      });
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribe(audioUri: string): Promise<VoiceRecordingResult> {
    this.notifyState({
      isRecording: false,
      isProcessing: true,
      duration: 0,
      error: null,
    });

    try {
      // Read the audio file
      const audioData = await FileSystem.readAsStringAsync(audioUri, {
        encoding: 'base64',
      });

      // Determine MIME type based on file extension
      // const extension = audioUri.split('.').pop()?.toLowerCase() || 'm4a'; // TODO: Use for content-type header
      // const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/m4a';

      // Call OpenAI Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''}`,
          'Content-Type': 'multipart/form-data',
        },
        body: JSON.stringify({
          file: audioData,
          model: 'whisper-1',
          response_format: 'verbose_json',
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message || 'Transcription failed');
      }

      const result = await response.json() as any;

      // Clean up the audio file
      try {
        await FileSystem.deleteAsync(audioUri);
      } catch {
        // File might not exist
      }

      this.notifyState({
        isRecording: false,
        isProcessing: false,
        duration: 0,
        error: null,
      });

      return {
        transcript: result.text || '',
        duration: result.duration || 0,
        confidence: this.calculateConfidence(result),
      };
    } catch (error) {
      console.error('Error transcribing audio:', error);

      // Clean up the audio file
      try {
        await FileSystem.deleteAsync(audioUri);
      } catch {
        // File might not exist
      }

      this.notifyState({
        isRecording: false,
        isProcessing: false,
        duration: 0,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Calculate confidence score from transcription result
   */
  private calculateConfidence(result: any): number {
    // Whisper doesn't provide per-word confidence, but we can estimate
    // based on the "no_speech_prob" and "language" confidence if available
    if (result.no_speech_prob !== undefined) {
      return 1 - result.no_speech_prob;
    }
    return 0.85; // Default high confidence
  }

  /**
   * Record and transcribe in one operation
   */
  async recordAndTranscribe(
    maxDuration: number = 30,
    onStateChange?: (state: VoiceRecordingState) => void
  ): Promise<VoiceRecordingResult> {
    // Start recording
    const started = await this.startRecording(onStateChange);
    if (!started) {
      throw new Error('Failed to start recording');
    }

    // Auto-stop after max duration
    const maxDurationTimer = setTimeout(async () => {
      if (this.recording) {
        await this.stopRecording();
      }
    }, maxDuration * 1000) as unknown as NodeJS.Timeout;

    // Wait for user to stop (this would be called by UI)
    return new Promise((resolve, reject) => {
      // This is a placeholder - actual implementation would wait for UI trigger
      // For now, auto-stop after 5 seconds for testing
      setTimeout(async () => {
        clearTimeout(maxDurationTimer);
        try {
          const { uri } = await this.stopRecording();
          if (uri) {
            const result = await this.transcribe(uri);
            resolve(result);
          } else {
            reject(new Error('No audio file created'));
          }
        } catch (error) {
          reject(error);
        }
      }, 5000);
    });
  }

  /**
   * Notify state change
   */
  private notifyState(state: VoiceRecordingState): void {
    if (this.stateCallback) {
      this.stateCallback(state);
    }
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recording !== null;
  }

  /**
   * Get current recording duration
   */
  getDuration(): number {
    if (this.recordingStartTime > 0) {
      return (Date.now() - this.recordingStartTime) / 1000;
    }
    return 0;
  }
}

// Export singleton instance
export const voiceService = new VoiceService();

// Export a hook for React components
export interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isProcessing: boolean;
  duration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<VoiceRecordingResult | null>;
  cancelRecording: () => Promise<void>;
}

export function useVoiceRecording(): UseVoiceRecordingReturn {
  // This would use React state in a real implementation
  // For now, return the service methods
  return {
    isRecording: voiceService.isRecording(),
    isProcessing: false,
    duration: voiceService.getDuration(),
    error: null,
    startRecording: async () => {
      const started = await voiceService.startRecording();
      if (!started) {
        throw new Error('Failed to start recording');
      }
    },
    stopRecording: async () => {
      const { uri } = await voiceService.stopRecording();
      if (uri) {
        return voiceService.transcribe(uri);
      }
      return null;
    },
    cancelRecording: () => voiceService.cancelRecording(),
  };
}
