import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input } from '@fitness-tracker/ui';
import { authService } from '../../lib/amplify';
import { useUserStore } from '../../lib/store';

export default function AuthScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUserId, setEmail: setUserEmail, setAuthenticated } = useUserStore();

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const result = await authService.signIn(email, password);
        if (result.isSignedIn) {
          setUserId(email); // Using email as temporary ID
          setUserEmail(email);
          setAuthenticated(true);
          router.replace('/(tabs)');
        }
      } else {
        const result = await authService.signUp(email, password);
        if (result.isSignUpComplete) {
          setUserId(email);
          setUserEmail(email);
          setAuthenticated(true);
          router.replace('/(tabs)');
        } else if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP_STEP') {
          Alert.alert(
            'Confirm your account',
            'Please check your email for a confirmation code.'
          );
          // In production, you would navigate to a confirmation screen
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>FitTrack</Text>
          <Text style={styles.tagline}>Your AI-Powered Fitness Companion</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          <Button
            title={isLogin ? 'Sign In' : 'Create Account'}
            onPress={handleSubmit}
            loading={loading}
            size="large"
            style={styles.submitButton}
          />

          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <Text
              style={styles.switchLink}
              onPress={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </Text>
          </View>
        </View>

        {/* Demo credentials hint */}
        <View style={styles.demoHint}>
          <Text style={styles.demoHintText}>
            Demo: Use any email/password to explore the app
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: '#6366f1',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#6b7280',
  },
  form: {
    gap: 16,
  },
  submitButton: {
    marginTop: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  switchText: {
    color: '#6b7280',
    fontSize: 14,
  },
  switchLink: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  demoHint: {
    marginTop: 40,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    alignItems: 'center',
  },
  demoHintText: {
    fontSize: 12,
    color: '#92400e',
  },
});
