import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function TestApp() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Text style={styles.text}>Hello from Guess the Spot!</Text>
        <Text style={styles.subtext}>Testing Expo Go on physical device</Text>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  text: {
    fontSize: 24,
    color: '#3282b8',
    fontWeight: 'bold',
  },
  subtext: {
    fontSize: 16,
    color: '#ffffff',
    marginTop: 10,
  },
});