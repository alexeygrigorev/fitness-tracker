// AWS Amplify Configuration
// This file configures the AWS Amplify services for authentication and GraphQL API

import { Amplify } from 'aws-amplify';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  confirmSignUp as amplifyConfirmSignUp,
  autoSignIn as amplifyAutoSignIn,
  fetchAuthSession,
  getCurrentUser,
  type SignInInput,
  type SignUpInput,
} from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/api';
import * as mutations from './graphql/mutations';
import * as queries from './graphql/queries';

// Amplify configuration - in production these values come from amplify_outputs.json
// For local development, we use mock endpoints
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_USER_POOL_ID || 'eu-west-1_local',
      userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID || 'local-client-id',
      identityPoolId: process.env.EXPO_PUBLIC_IDENTITY_POOL_ID || 'eu-west-1:local-identity-pool',
      region: process.env.EXPO_PUBLIC_AWS_REGION || 'eu-west-1',
      // Allow unauthenticated logins for demo mode
      allowGuestAccess: true,
      // Password policy
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: false,
      },
    },
  },
  API: {
    GraphQL: {
      endpoint: process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4566/graphql',
      region: process.env.EXPO_PUBLIC_AWS_REGION || 'eu-west-1',
      defaultAuthMode: 'userPool' as const,
      // Max timeout for API calls (in milliseconds)
      timeout: 30000,
    },
  },
};

// Initialize Amplify
try {
  Amplify.configure(amplifyConfig);
} catch (error) {
  // Amplify may already be configured
  console.warn('Amplify configuration warning:', error);
}

// GraphQL Client using the new API
export const graphqlClient: ReturnType<typeof generateClient> = generateClient({
  authMode: 'userPool',
});

// ============================================
// Authentication Service
// ============================================

interface AuthSession {
  tokens: {
    accessToken: { toString(): string };
    idToken?: { toString(): string };
    refreshToken?: { toString(): string };
  } | null;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  };
  identityId?: string;
  userSub?: string;
}

interface SignInResult {
  isSignedIn: boolean;
  nextStep?: {
    signInStep: string;
    code?: string;
  };
}

interface SignUpResult {
  isSignUpComplete: boolean;
  userId?: string;
  nextStep?: {
    signUpStep: string;
    code?: string;
  };
}

interface AuthService {
  getCurrentSession: () => Promise<AuthSession | null>;
  getCurrentUser: () => Promise<any>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  confirmSignUp: (email: string, code: string) => Promise<any>;
  signOut: () => Promise<void>;
  handleAutoSignIn: () => Promise<{ success: boolean }>;
  isAuthenticated: () => Promise<boolean>;
  getAccessToken: () => Promise<string | null>;
  resendSignUpCode: (email: string) => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
  confirmResetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean }>;
  updatePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean }>;
}

export const authService: AuthService = {
  /**
   * Get the current authenticated session
   */
  getCurrentSession: async (): Promise<AuthSession | null> => {
    try {
      const session = await fetchAuthSession();
      return session as AuthSession;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  /**
   * Get current authenticated user attributes
   */
  getCurrentUser: async () => {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens) {
        return null;
      }

      const user = await getCurrentUser();
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  /**
   * Sign in with email and password
   */
  signIn: async (email: string, password: string): Promise<SignInResult> => {
    try {
      const input: SignInInput = {
        username: email,
        password,
      };

      const result = await amplifySignIn(input);

      return {
        isSignedIn: result.isSignedIn,
        nextStep: result.nextStep,
      };
    } catch (error: unknown) {
      console.error('Error signing in:', error);
      throw new Error((error as Error).message || 'Authentication failed');
    }
  },

  /**
   * Sign up a new user
   */
  signUp: async (email: string, password: string): Promise<SignUpResult> => {
    try {
      const input: SignUpInput = {
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          },
          autoSignIn: true,
        },
      };

      const result = await amplifySignUp(input);

      return {
        isSignUpComplete: result.isSignUpComplete,
        userId: result.userId,
        nextStep: result.nextStep,
      };
    } catch (error: unknown) {
      console.error('Error signing up:', error);
      throw new Error((error as Error).message || 'Sign up failed');
    }
  },

  /**
   * Confirm sign up with verification code
   */
  confirmSignUp: async (email: string, code: string) => {
    try {
      const result = await amplifyConfirmSignUp({
        username: email,
        confirmationCode: code,
      });

      return {
        isComplete: result.isSignUpComplete,
        nextStep: result.nextStep,
      };
    } catch (error: unknown) {
      console.error('Error confirming sign up:', error);
      throw new Error((error as Error).message || 'Confirmation failed');
    }
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    try {
      await amplifySignOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  /**
   * Handle auto sign in after confirmation
   */
  handleAutoSignIn: async () => {
    try {
      await amplifyAutoSignIn();
      return { success: true };
    } catch (error) {
      console.error('Error with auto sign in:', error);
      return { success: false };
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: async (): Promise<boolean> => {
    try {
      const session = await fetchAuthSession({ forceRefresh: false });
      return !!session.tokens?.accessToken;
    } catch {
      return false;
    }
  },

  /**
   * Get JWT access token
   */
  getAccessToken: async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken.toString() || null;
    } catch {
      return null;
    }
  },

  /**
   * Resend sign up confirmation code
   */
  resendSignUpCode: async (email: string) => {
    try {
      const { resendSignUpCode } = await import('aws-amplify/auth');
      const result = await resendSignUpCode({
        username: email,
      });
      return result;
    } catch (error: unknown) {
      console.error('Error resending code:', error);
      throw new Error((error as Error).message || 'Failed to resend code');
    }
  },

  /**
   * Reset password (forgot password)
   */
  resetPassword: async (email: string) => {
    try {
      const { resetPassword } = await import('aws-amplify/auth');
      const result = await resetPassword({
        username: email,
      });
      return result;
    } catch (error: unknown) {
      console.error('Error initiating password reset:', error);
      throw new Error((error as Error).message || 'Failed to initiate password reset');
    }
  },

  /**
   * Confirm new password with code
   */
  confirmResetPassword: async (email: string, code: string, newPassword: string) => {
    try {
      const { confirmResetPassword } = await import('aws-amplify/auth');
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword,
      });
      return { success: true };
    } catch (error: unknown) {
      console.error('Error confirming password reset:', error);
      throw new Error((error as Error).message || 'Failed to reset password');
    }
  },

  /**
   * Update password for authenticated user
   */
  updatePassword: async (oldPassword: string, newPassword: string) => {
    try {
      const { updatePassword } = await import('aws-amplify/auth');
      await updatePassword({ oldPassword, newPassword });
      return { success: true };
    } catch (error: unknown) {
      console.error('Error updating password:', error);
      throw new Error((error as Error).message || 'Failed to update password');
    }
  },
};

// ============================================
// GraphQL API Service
// ============================================

export const apiService = {
  /**
   * Execute a GraphQL query
   */
  query: async <T = any>(query: string, variables?: Record<string, any>): Promise<T> => {
    try {
      const result = await graphqlClient.graphql<any>({ query: query as any, variables: variables || {} });
      return result.data as T;
    } catch (error) {
      console.error('GraphQL query error:', error);
      throw error;
    }
  },

  /**
   * Execute a GraphQL mutation
   */
  mutate: async <T = any>(mutation: string, variables?: Record<string, any>): Promise<T> => {
    try {
      const result = await graphqlClient.graphql<any>({ query: mutation as any, variables: variables || {} });
      return result.data as T;
    } catch (error) {
      console.error('GraphQL mutation error:', error);
      throw error;
    }
  },

  // Export generated queries and mutations
  mutations,
  queries,
};

// Export for backward compatibility
export default amplifyConfig;
