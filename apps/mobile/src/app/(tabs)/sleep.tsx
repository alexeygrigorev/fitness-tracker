import { View, Text, StyleSheet } from 'react-native';

export default function SleepScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sleep</Text>
      <Text>Sleep tracking coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});
