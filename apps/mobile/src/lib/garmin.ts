// Garmin Connect Integration Service
// Handles OAuth flow and data synchronization with Garmin Health API

import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

// Garmin OAuth Configuration
const GARMIN_CONFIG = {
  // These should come from environment variables in production
  oauthUrl: 'https://connect.garmin.com/oauthConfirm',
  consumerKey: process.env.EXPO_PUBLIC_GARMIN_CONSUMER_KEY || '',
  consumerSecret: process.env.EXPO_PUBLIC_GARMIN_CONSUMER_SECRET || '',
  callbackUrl: process.env.EXPO_PUBLIC_GARMIN_CALLBACK_URL || 'myfitnessapp://garmin/callback',
  requestTokenUrl: 'https://connectapi.garmin.com/oauth-service/oauth/request_token',
  accessTokenUrl: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
  apiUrl: 'https://apis.garmin.com/wellness-api',
};

// Storage keys
const STORAGE_KEYS = {
  OAUTH_TOKEN: 'garmin_oauth_token',
  OAUTH_SECRET: 'garmin_oauth_secret',
  USER_ID: 'garmin_user_id',
  LAST_SYNC: 'garmin_last_sync',
};

// ============================================
// Types
// ============================================

export interface GarminToken {
  oauthToken: string;
  oauthTokenSecret: string;
  userId: string;
}

export interface GarminActivity {
  userId: string;
  activityId: string;
  activityName: string;
  activityType: string;
  startTimeInSeconds: number;
  durationInSeconds: number;
  steps: number;
  distanceInMeters: number;
  calories: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
}

export interface GarminSleep {
  userId: string;
  sleepTimeSeconds: number;
  deepSleepSeconds: number;
  lightSleepSeconds: number;
  remSleepSeconds: number;
  awakeSeconds: number;
  sleepStartTimestampGMT: number;
  sleepEndTimestampGMT: number;
  overallSleepScore?: number;
}

export interface GarminHeartRate {
  userId: string;
  heartRateSamples: Array<{
    time: string;
    heartRate: number;
  }>;
}

export interface GarminSyncResult {
  activities: GarminActivity[];
  sleepData?: GarminSleep;
  lastSync: Date;
  success: boolean;
  error?: string;
}

// ============================================
// Garmin Service
// ============================================

class GarminService {
  private isConnected: boolean = false;
  private token: GarminToken | null = null;

  /**
   * Initialize the Garmin service by loading stored tokens
   */
  async initialize(): Promise<boolean> {
    try {
      const oauthToken = await SecureStore.getItemAsync(STORAGE_KEYS.OAUTH_TOKEN);
      const oauthTokenSecret = await SecureStore.getItemAsync(STORAGE_KEYS.OAUTH_SECRET);
      const userId = await SecureStore.getItemAsync(STORAGE_KEYS.USER_ID);

      if (oauthToken && oauthTokenSecret && userId) {
        this.token = {
          oauthToken,
          oauthTokenSecret,
          userId,
        };
        this.isConnected = true;
        return true;
      }

      this.isConnected = false;
      return false;
    } catch (error) {
      console.error('Error initializing Garmin service:', error);
      return false;
    }
  }

  /**
   * Check if Garmin is connected
   */
  async checkConnectionStatus(): Promise<boolean> {
    await this.initialize();
    return this.isConnected;
  }

  /**
   * Start the OAuth flow to connect Garmin
   */
  async connect(): Promise<{ success: boolean; error?: string }> {
    try {
      // In a production implementation, this would:
      // 1. Request an OAuth request token from Garmin
      // 2. Open a browser/web view for user authorization
      // 3. Handle the callback with the OAuth verifier
      // 4. Exchange for an access token

      // For now, we'll simulate the flow with a mock
      // In production, use the proper OAuth 1.0a flow

      // Open Garmin OAuth page in browser
      const authUrl = `${GARMIN_CONFIG.oauthUrl}?${new URLSearchParams({
        oauth_callback: GARMIN_CONFIG.callbackUrl,
        oauth_consumer_key: GARMIN_CONFIG.consumerKey,
      })}`;

      const result = await WebBrowser.openBrowserAsync(authUrl);

      // Note: In a real implementation, you would handle the OAuth redirect
      // For now, we'll assume success if the browser was opened
      if (result.type === 'cancel') {
        return { success: false, error: 'OAuth flow cancelled' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error connecting to Garmin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clear stored OAuth tokens (disconnect)
   */
  async disconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.OAUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.OAUTH_SECRET);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_SYNC);

      this.token = null;
      this.isConnected = false;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect',
      };
    }
  }

  /**
   * Sync activities from Garmin
   */
  async syncActivities(
    startDate: Date,
    _endDate: Date = new Date()
  ): Promise<GarminActivity[]> {
    if (!this.isConnected || !this.token) {
      throw new Error('Garmin is not connected');
    }

    try {
      // In production, make an authenticated API call to Garmin
      // const activitiesUrl = `${GARMIN_CONFIG.apiUrl}/activities`;
      // const response = await fetch(activitiesUrl, {
      //   headers: {
      //     Authorization: `Bearer ${this.token.oauthToken}`,
      //   },
      // });

      // For now, return mock data
      const mockActivities: GarminActivity[] = [
        {
          userId: this.token.userId,
          activityId: '123456',
          activityName: 'Morning Run',
          activityType: 'RUNNING',
          startTimeInSeconds: Math.floor(startDate.getTime() / 1000),
          durationInSeconds: 2700,
          steps: 3500,
          distanceInMeters: 5000,
          calories: 300,
          averageHeartRate: 145,
          maxHeartRate: 170,
        },
      ];

      return mockActivities;
    } catch (error) {
      console.error('Error syncing activities:', error);
      throw error;
    }
  }

  /**
   * Sync sleep data from Garmin
   */
  async syncSleep(date: Date): Promise<GarminSleep | null> {
    if (!this.isConnected || !this.token) {
      throw new Error('Garmin is not connected');
    }

    try {
      // In production, make an authenticated API call to Garmin
      // const sleepUrl = `${GARMIN_CONFIG.apiUrl}/sleep`;
      // const response = await fetch(sleepUrl, {
      //   headers: {
      //     Authorization: `Bearer ${this.token.oauthToken}`,
      //   },
      // });

      // For now, return mock data
      const mockSleep: GarminSleep = {
        userId: this.token.userId,
        sleepTimeSeconds: 28800, // 8 hours
        deepSleepSeconds: 5400, // 1.5 hours
        lightSleepSeconds: 16200, // 4.5 hours
        remSleepSeconds: 5400, // 1.5 hours
        awakeSeconds: 1800, // 30 minutes
        sleepStartTimestampGMT: Math.floor(
          new Date(date).setHours(23, 0, 0, 0) / 1000
        ),
        sleepEndTimestampGMT: Math.floor(
          new Date(date).setHours(7, 0, 0, 0) / 1000
        ),
        overallSleepScore: 85,
      };

      return mockSleep;
    } catch (error) {
      console.error('Error syncing sleep data:', error);
      return null;
    }
  }

  /**
   * Sync heart rate data from Garmin
   */
  async syncHeartRate(_date: Date): Promise<GarminHeartRate | null> {
    if (!this.isConnected || !this.token) {
      throw new Error('Garmin is not connected');
    }

    try {
      // In production, make an authenticated API call to Garmin
      // For now, return mock data
      const mockHeartRate: GarminHeartRate = {
        userId: this.token.userId,
        heartRateSamples: Array.from({ length: 24 }, (_, i) => ({
          time: `${String(i).padStart(2, '0')}:00`,
          heartRate: 60 + Math.floor(Math.random() * 40), // 60-100 bpm
        })),
      };

      return mockHeartRate;
    } catch (error) {
      console.error('Error syncing heart rate data:', error);
      return null;
    }
  }

  /**
   * Perform a full sync with Garmin
   */
  async fullSync(startDate: Date, endDate: Date = new Date()): Promise<GarminSyncResult> {
    try {
      const activities = await this.syncActivities(startDate, endDate);
      const sleepData = await this.syncSync(endDate);
      const lastSync = new Date();

      // Save last sync time
      await SecureStore.setItemAsync(
        STORAGE_KEYS.LAST_SYNC,
        lastSync.toISOString()
      );

      return {
        activities,
        sleepData: sleepData || undefined,
        lastSync,
        success: true,
      };
    } catch (error) {
      return {
        activities: [],
        lastSync: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }

  /**
   * Get the last sync timestamp
   */
  async getLastSync(): Promise<Date | null> {
    const lastSyncStr = await SecureStore.getItemAsync(STORAGE_KEYS.LAST_SYNC);
    return lastSyncStr ? new Date(lastSyncStr) : null;
  }

  /**
   * Sync sleep data (private helper)
   */
  private async syncSync(date: Date): Promise<GarminSleep | null> {
    return this.syncSleep(date);
  }
}

// Export singleton instance
export const garminService = new GarminService();

// Export hook for React components
export interface UseGarminReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sync: (startDate: Date, endDate?: Date) => Promise<GarminSyncResult>;
  getLastSync: () => Promise<Date | null>;
}

export function useGarmin(): UseGarminReturn {
  let isConnecting = false;
  let error: string | null = null;

  return {
    isConnected: false, // Would be tracked with useState in actual implementation
    isConnecting,
    error,
    connect: async () => {
      isConnecting = true;
      error = null;
      try {
        const result = await garminService.connect();
        if (!result.success) {
          error = result.error || 'Connection failed';
        }
      } catch (err) {
        error = (err as Error).message;
      } finally {
        isConnecting = false;
      }
    },
    disconnect: async () => {
      await garminService.disconnect();
    },
    sync: async (startDate, endDate) => {
      return garminService.fullSync(startDate, endDate);
    },
    getLastSync: () => garminService.getLastSync(),
  };
}
