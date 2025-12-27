import { Redirect } from 'expo-router';

export default function Index() {
  // TODO: Check auth state and redirect accordingly
  return <Redirect href="/(tabs)" />;
}
