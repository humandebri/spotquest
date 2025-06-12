import React from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import clearAllStorage from './clearStorage';

export default function DebugApp() {
  const [logs, setLogs] = React.useState<string[]>([]);
  const [storageCleared, setStorageCleared] = React.useState(false);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  React.useEffect(() => {
    addLog('Debug app started');
    
    // Override console methods to capture logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      addLog(`LOG: ${args.join(' ')}`);
      originalLog(...args);
    };

    console.error = (...args) => {
      addLog(`ERROR: ${args.join(' ')}`);
      originalError(...args);
    };

    console.warn = (...args) => {
      addLog(`WARN: ${args.join(' ')}`);
      originalWarn(...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  const handleClearStorage = async () => {
    try {
      addLog('Clearing storage...');
      await clearAllStorage();
      setStorageCleared(true);
      addLog('Storage cleared successfully');
    } catch (error) {
      addLog(`Storage clear error: ${error}`);
    }
  };

  const testJSONParse = () => {
    addLog('Testing JSON.parse...');
    
    // Test valid JSON
    try {
      const result = JSON.parse('{"test": "value"}');
      addLog(`Valid JSON parsed: ${JSON.stringify(result)}`);
    } catch (error) {
      addLog(`Valid JSON parse error: ${error}`);
    }

    // Test invalid JSON
    try {
      const result = JSON.parse('not json');
      addLog(`Invalid JSON parsed: ${JSON.stringify(result)}`);
    } catch (error) {
      addLog(`Invalid JSON parse error (expected): ${error}`);
    }
  };

  const testStorageOperations = async () => {
    addLog('Testing storage operations...');
    
    try {
      // Test localStorage on web
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('test_key', 'test_value');
        const value = localStorage.getItem('test_key');
        addLog(`localStorage test: ${value}`);
        localStorage.removeItem('test_key');
      } else {
        addLog('localStorage not available');
      }
    } catch (error) {
      addLog(`Storage test error: ${error}`);
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.header}>
          <Text style={styles.title}>Guess-the-Spot Debug</Text>
          <Text style={styles.subtitle}>Storage cleared: {storageCleared ? 'Yes' : 'No'}</Text>
        </View>
        
        <View style={styles.buttons}>
          <Button title="Clear Storage" onPress={handleClearStorage} />
          <Button title="Test JSON Parse" onPress={testJSONParse} />
          <Button title="Test Storage" onPress={testStorageOperations} />
        </View>

        <ScrollView style={styles.logContainer}>
          <Text style={styles.logTitle}>Logs:</Text>
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
    backgroundColor: '#3498db',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginTop: 5,
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