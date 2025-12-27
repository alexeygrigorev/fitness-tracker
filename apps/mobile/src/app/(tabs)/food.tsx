import { View, Text, StyleSheet } from 'react-native';

export default function FoodScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Food</Text>
      <Text>Nutrition tracking coming soon...</Text>
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
