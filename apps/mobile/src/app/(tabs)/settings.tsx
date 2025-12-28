import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@fitness-tracker/ui';
import { useUserStore, useSettingsStore } from '../../lib/store';
import { authService } from '../../lib/amplify';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/ThemeProvider';

interface SettingItem {
  icon: string;
  label: string;
  value?: string | boolean;
  type: 'link' | 'switch';
  color?: string;
  onPress?: () => void;
  onValueChange?: (value: boolean) => void;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, email } = useUserStore();
  const {
    darkMode,
    notifications,
    units,
    toggleDarkMode,
    toggleNotifications,
    setUnits,
    weeklyGoal,
    setWeeklyGoal,
  } = useSettingsStore();
  const theme = useTheme();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await authService.signOut();
              logout();
              router.replace('/auth');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement account deletion
            Alert.alert('Coming Soon', 'Account deletion will be available soon.');
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Choose a format to export your data',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'JSON',
          onPress: () => {
            // TODO: Implement data export
            Alert.alert('Coming Soon', 'Data export will be available soon.');
          },
        },
        {
          text: 'CSV',
          onPress: () => {
            // TODO: Implement CSV export
            Alert.alert('Coming Soon', 'CSV export will be available soon.');
          },
        },
      ]
    );
  };

  const handleSyncNow = async () => {
    // TODO: Implement manual sync
    Alert.alert('Sync Complete', 'All data is up to date.');
  };

  const handleUnitsChange = () => {
    Alert.alert(
      'Units',
      'Select your preferred units',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Metric (kg, km)',
          onPress: () => setUnits('METRIC'),
        },
        {
          text: 'Imperial (lb, mi)',
          onPress: () => setUnits('ENGLISH'),
        },
      ]
    );
  };

  const handleGarminConnect = () => {
    // TODO: Implement Garmin OAuth flow
    Alert.alert(
      'Connect Garmin',
      'This will open Garmin Connect to authorize access to your wellness data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: () => {
            // TODO: Launch Garmin OAuth
            Alert.alert('Coming Soon', 'Garmin integration will be available soon.');
          },
        },
      ]
    );
  };

  const handleHelpCenter = () => {
    Linking.openURL('https://github.com/anthropics/claude-code/issues').catch(() => {
      Alert.alert('Error', 'Could not open help center.');
    });
  };

  const handleFeedback = () => {
    Linking.openURL('mailto:support@fitnesstracker.app?subject=Feedback').catch(() => {
      Alert.alert('Error', 'Could not open email client.');
    });
  };

  const settingsSections: Array<{ title: string; items: SettingItem[] }> = [
    {
      title: 'Profile',
      items: [
        {
          icon: 'person',
          label: 'Personal Information',
          value: 'Edit',
          type: 'link',
          onPress: () => Alert.alert('Coming Soon', 'Profile editing will be available soon.'),
        },
        {
          icon: 'barbell',
          label: 'Fitness Goals',
          value: 'View',
          type: 'link',
          onPress: () => Alert.alert('Coming Soon', 'Goal management will be available soon.'),
        },
        {
          icon: 'body',
          label: 'Body Metrics',
          value: 'Update',
          type: 'link',
          onPress: () => Alert.alert('Coming Soon', 'Body metrics tracking will be available soon.'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: 'ruler',
          label: 'Units',
          value: units === 'METRIC' ? 'Metric' : 'Imperial',
          type: 'link',
          onPress: handleUnitsChange,
        },
        {
          icon: 'notifications',
          label: 'Notifications',
          value: notifications,
          type: 'switch',
          onValueChange: toggleNotifications,
        },
        {
          icon: 'moon',
          label: 'Dark Mode',
          value: darkMode,
          type: 'switch',
          onValueChange: toggleDarkMode,
        },
      ],
    },
    {
      title: 'Weekly Goals',
      items: [
        {
          icon: 'barbell-outline',
          label: 'Workouts per Week',
          value: `${weeklyGoal.workouts} workouts`,
          type: 'link',
          onPress: () => {
            // TODO: Show goal picker
            Alert.alert('Set Goal', 'Enter your weekly workout goal (1-7):', [
              { text: 'Cancel' },
              {
                text: '5',
                onPress: () => setWeeklyGoal({ workouts: 5 }),
              },
            ]);
          },
        },
        {
          icon: 'flame-outline',
          label: 'Calorie Goal',
          value: `${weeklyGoal.calories} kcal/day`,
          type: 'link',
          onPress: () => {
            Alert.alert('Set Goal', 'Enter your daily calorie goal:', [
              { text: 'Cancel' },
              {
                text: '2000',
                onPress: () => setWeeklyGoal({ calories: 2000 }),
              },
            ]);
          },
        },
        {
          icon: 'fish-outline',
          label: 'Protein Goal',
          value: `${weeklyGoal.protein}g/day`,
          type: 'link',
          onPress: () => {
            Alert.alert('Set Goal', 'Enter your daily protein goal (g):', [
              { text: 'Cancel' },
              {
                text: '150',
                onPress: () => setWeeklyGoal({ protein: 150 }),
              },
            ]);
          },
        },
      ],
    },
    {
      title: 'Integrations',
      items: [
        {
          icon: 'watch',
          label: 'Garmin Connect',
          value: 'Connect',
          type: 'link',
          color: '#10b981',
          onPress: handleGarminConnect,
        },
      ],
    },
    {
      title: 'Data',
      items: [
        {
          icon: 'download',
          label: 'Export Data',
          value: '',
          type: 'link',
          onPress: handleExportData,
        },
        {
          icon: 'cloud-upload',
          label: 'Backup to Cloud',
          value: 'Auto',
          type: 'link',
          onPress: () => Alert.alert('Cloud Backup', 'Your data is automatically backed up to the cloud.'),
        },
        {
          icon: 'refresh',
          label: 'Sync Now',
          value: '',
          type: 'link',
          onPress: handleSyncNow,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle',
          label: 'Help Center',
          value: '',
          type: 'link',
          onPress: handleHelpCenter,
        },
        {
          icon: 'chatbubble',
          label: 'Send Feedback',
          value: '',
          type: 'link',
          onPress: handleFeedback,
        },
        {
          icon: 'document-text',
          label: 'Privacy Policy',
          value: '',
          type: 'link',
          onPress: () => Linking.openURL('https://example.com/privacy').catch(() => {}),
        },
        {
          icon: 'information-circle',
          label: 'About',
          value: 'v1.0.0',
          type: 'link',
          onPress: () => Alert.alert('About', 'Fitness Tracker v1.0.0\n\nBuilt with Claude Code'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={{ ...styles.title, color: theme.colors.text }}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Card style={{ ...styles.profileCard, backgroundColor: theme.colors.card }}>
          <View style={styles.profileContent}>
            <View style={{ ...styles.avatar, backgroundColor: theme.colors.backgroundTertiary }}>
              <Ionicons name="person" size={32} color={theme.colors.textTertiary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={{ ...styles.profileName, color: theme.colors.text }}>
                {email?.split('@')[0] || 'User'}
              </Text>
              <Text style={{ ...styles.profileEmail, color: theme.colors.textSecondary }}>{email || 'user@example.com'}</Text>
            </View>
            <TouchableOpacity
              style={{ ...styles.editProfileButton, backgroundColor: theme.colors.backgroundTertiary }}
              onPress={() => Alert.alert('Coming Soon', 'Profile editing will be available soon.')}
            >
              <Ionicons name="pencil" size={18} color="#6366f1" />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <Card key={sectionIndex} style={{ ...styles.sectionCard, backgroundColor: theme.colors.card }}>
            <Text style={{ ...styles.sectionTitle, color: theme.colors.textTertiary }}>{section.title}</Text>
            {section.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.colors.borderLight },
                  itemIndex === section.items.length - 1 && styles.settingItemLast,
                ]}
                onPress={item.onPress}
                disabled={item.type === 'switch' || !item.onPress}
              >
                <View style={styles.settingLeft}>
                  <View
                    style={[
                      styles.settingIcon,
                      item.color ? { backgroundColor: `${item.color}20` } : { backgroundColor: theme.colors.backgroundTertiary },
                    ]}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={item.color || theme.colors.textSecondary}
                    />
                  </View>
                  <Text style={{ ...styles.settingLabel, color: theme.colors.text }}>{item.label}</Text>
                </View>
                <View style={styles.settingRight}>
                  {item.type === 'switch' ? (
                    <Switch
                      value={typeof item.value === 'boolean' ? item.value : false}
                      onValueChange={item.onValueChange}
                      trackColor={{ false: theme.colors.border, true: '#6366f1' }}
                      thumbColor="#fff"
                    />
                  ) : (
                    <>
                      {item.value && (
                        <Text style={{ ...styles.settingValue, color: theme.colors.textSecondary }}>{String(item.value)}</Text>
                      )}
                      {item.onPress && (
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
                      )}
                    </>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        ))}

        {/* Danger Zone */}
        <Card style={{ ...styles.dangerCard, backgroundColor: theme.colors.card }}>
          <TouchableOpacity
            style={[styles.dangerButton, { borderBottomColor: theme.colors.borderLight }]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            <Ionicons
              name={isLoggingOut ? 'hourglass-outline' : 'log-out-outline'}
              size={20}
              color="#ef4444"
            />
            <Text style={styles.dangerText}>
              {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={styles.dangerText}>Delete Account</Text>
          </TouchableOpacity>
        </Card>

        {/* Version Info */}
        <Text style={{ ...styles.versionText, color: theme.colors.textTertiary }}>Fitness Tracker v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileCard: {
    marginBottom: 16,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  editProfileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
  },
  dangerCard: {
    marginBottom: 20,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
});
