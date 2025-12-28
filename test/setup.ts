// Test setup file for Vitest
import { vi } from 'vitest';

// Mock environment variables
process.env.EXPO_PUBLIC_OPENAI_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_AWS_REGION = 'eu-west-1';

// Mock expo-modules
vi.mock('expo-secure-store', () => ({
  default: {
    getItemAsync: vi.fn(() => Promise.resolve(null)),
    setItemAsync: vi.fn(() => Promise.resolve()),
    deleteItemAsync: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(() => Promise.resolve(new Uint8Array(16))),
}));

// Mock expo-file-system
vi.mock('expo-file-system', () => ({
  documentDirectory: 'file://test/',
  cacheDirectory: 'file://test/cache/',
}));

// Mock Amplify
vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn(),
  },
}));

vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  confirmSignUp: vi.fn(),
  fetchAuthSession: vi.fn(() => Promise.resolve({
    tokens: {
      accessToken: { toString: () => 'test-token' },
    },
  })),
  getCurrentUser: vi.fn(() => Promise.resolve({
    userId: 'test-user-id',
    username: 'test-user',
  })),
  autoSignIn: vi.fn(),
}));

// Mock Apollo
vi.mock('@apollo/client', () => ({
  ApolloClient: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    mutate: vi.fn(),
    subscribe: vi.fn(),
  })),
  InMemoryCache: vi.fn(),
  createHttpLink: vi.fn(),
  ApolloLink: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@apollo/client/link/error', () => ({
  onError: vi.fn(() => ({ forward: vi.fn() })),
}));

vi.mock('@apollo/client/link/retry', () => ({
  RetryLink: vi.fn(),
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(() => Promise.resolve({
          choices: [{ message: { content: '{}' } }],
        })),
      },
    },
    audio: {
      transcriptions: {
        create: vi.fn(() => Promise.resolve('test transcription')),
      },
    },
  })),
}));

// Mock expo-camera
vi.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
  },
  CameraView: 'CameraView',
  Barcode: {
    EAN_13: 'EAN_13',
    EAN_8: 'EAN_8',
    UPC_A: 'UPC_A',
    UPC_E: 'UPC_E',
    CODE_128: 'CODE_128',
    CODE_39: 'CODE_39',
    CODE_93: 'CODE_93',
    ITF14: 'ITF14',
    DATA_BAR: 'DATA_BAR',
  },
}));

// Mock expo-image-picker
vi.mock('expo-image-picker', () => ({
  launchCameraAsync: vi.fn(() => Promise.resolve({
    canceled: false,
    assets: [{ uri: 'file://test.jpg', fileSize: 100000 }],
  })),
  launchImageLibraryAsync: vi.fn(() => Promise.resolve({
    canceled: false,
    assets: [{ uri: 'file://test.jpg', fileSize: 100000 }],
  })),
  requestMediaLibraryPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
  MediaTypeOptions: { Images: 'images' },
}));

// Mock expo-av (audio recording)
vi.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
    setAudioModeAsync: vi.fn(() => Promise.resolve()),
  },
  Recording: vi.fn().mockImplementation(() => ({
    prepareToRecordAsync: vi.fn(() => Promise.resolve()),
    startAsync: vi.fn(() => Promise.resolve()),
    stopAndUnloadAsync: vi.fn(() => Promise.resolve()),
    getURI: vi.fn(() => 'file://recording.m4a'),
    getStatus: vi.fn(() => Promise.resolve({ durationMillis: 5000 })),
  })),
}));

// Global test utilities
global.mockDate = (date: string) => {
  vi.setSystemTime(new Date(date));
};

global.resetMockDate = () => {
  vi.useRealTimers();
};
