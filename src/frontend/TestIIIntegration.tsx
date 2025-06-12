import React from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getSecureStorage, getRegularStorage } from './src/storage';
import { cryptoModule } from './src/crypto';

export default function TestIIIntegration() {
  const [logs, setLogs] = React.useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testStorage = async () => {
    addLog('Testing storage implementations...');
    
    try {
      const secureStorage = getSecureStorage();
      const regularStorage = getRegularStorage();
      
      // Test secure storage
      addLog('Testing secure storage...');
      await secureStorage.setItem('test_key', 'test_value');
      const value = await secureStorage.getItem('test_key');
      addLog(`Secure storage test: ${value}`);
      
      // Test regular storage
      addLog('Testing regular storage...');
      await regularStorage.setItem('test_key', 'test_value');
      const value2 = await regularStorage.getItem('test_key');
      addLog(`Regular storage test: ${value2}`);
      
      // Test find functionality
      addLog('Testing find functionality...');
      const keys = await secureStorage.find('test_');
      addLog(`Found keys: ${JSON.stringify(keys)}`);
      
      // Clean up
      await secureStorage.removeItem('test_key');
      await regularStorage.removeItem('test_key');
      addLog('Storage test completed successfully');
      
    } catch (error) {
      addLog(`Storage test error: ${error}`);
    }
  };

  const testCrypto = async () => {
    addLog('Testing crypto module...');
    
    try {
      // Test crypto functions
      const testData = 'Hello, World!';
      addLog(`Test data: ${testData}`);
      
      // Test digest
      if (cryptoModule.digest) {
        const digest = await cryptoModule.digest({ algorithm: 'SHA-256', data: testData });
        addLog(`SHA-256 digest: ${digest.substring(0, 20)}...`);
      }
      
      // Test getRandomValues
      if (cryptoModule.getRandomValues) {
        const randomBytes = new Uint8Array(16);
        cryptoModule.getRandomValues(randomBytes);
        addLog(`Random bytes: ${Array.from(randomBytes).slice(0, 4).join(', ')}...`);
      }
      
      addLog('Crypto test completed successfully');
    } catch (error) {
      addLog(`Crypto test error: ${error}`);
    }
  };

  const testIIIntegrationURL = async () => {
    addLog('Testing II Integration URL...');
    
    try {
      const canisterId = '77fv5-oiaaa-aaaal-qsoea-cai'; // Your unified canister
      const url = `https://${canisterId}.raw.icp0.io`;
      
      addLog(`Fetching: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
      });
      
      addLog(`Response status: ${response.status}`);
      addLog(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
      
      const text = await response.text();
      addLog(`Response preview: ${text.substring(0, 100)}...`);
      
      // Check if it's HTML
      if (text.trim().startsWith('<') || text.includes('<!DOCTYPE')) {
        addLog('⚠️ WARNING: Response is HTML, not expected format!');
      }
      
    } catch (error) {
      addLog(`URL test error: ${error}`);
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>II Integration Test</Text>
        </View>
        
        <View style={styles.buttons}>
          <Button title="Test Storage" onPress={testStorage} />
          <Button title="Test Crypto" onPress={testCrypto} />
          <Button title="Test II URL" onPress={testIIIntegrationURL} />
        </View>

        <ScrollView style={styles.logContainer}>
          <Text style={styles.logTitle}>Test Results:</Text>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logEntry}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    backgroundColor: '#2ecc71',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  buttons: {
    padding: 20,
    gap: 10,
  },
  logContainer: {
    flex: 1,
    backgroundColor: 'white',
    margin: 20,
    padding: 10,
    borderRadius: 5,
  },
  logTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logEntry: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 5,
    color: '#333',
  },
});