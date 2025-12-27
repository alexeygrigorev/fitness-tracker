import { View, Text, StyleSheet } from 'react-native';

export default function MetabolismScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Metabolism</Text>
      <Text>Metabolic insights coming soon...</Text>
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
