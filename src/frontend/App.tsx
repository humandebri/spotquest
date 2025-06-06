import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <Text style={styles.title}>🌍 Guess the Spot</Text>
        <Text style={styles.subtitle}>テストアプリ</Text>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={() => Alert.alert('Success!', 'アプリが正常に動作しています')}
        >
          <Text style={styles.buttonText}>テストボタン</Text>
        </TouchableOpacity>
        
        <View style={styles.status}>
          <Text style={styles.statusText}>✅ React Native 動作中</Text>
          <Text style={styles.statusText}>✅ Expo 動作中</Text>
          <Text style={styles.statusText}>✅ TypeScript 動作中</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#3282b8',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 40,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  status: {
    alignItems: 'center',
  },
  statusText: {
    color: '#4ade80',
    fontSize: 14,
    marginBottom: 8,
  },
});