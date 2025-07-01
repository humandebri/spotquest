import React, { Component, ReactNode } from 'react';
import { View, Text, Button, StyleSheet, Platform, ScrollView } from 'react-native';
import * as Updates from 'expo-updates';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('🔥 Global Error Boundary caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🔥 Error details:', error, errorInfo);
    
    // Log error details for debugging
    console.error('Stack trace:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Check if it's a TurboModule error
    if (error.message && (
      error.message.includes('TurboModule') ||
      error.message.includes('performVoidMethodInvocation') ||
      error.message.includes('NSInvocation') ||
      error.message.includes('Native module')
    )) {
      console.error('🔥 Detected TurboModule error!');
    }
    
    this.setState({ errorInfo });
  }

  handleReload = async () => {
    try {
      if (Platform.OS === 'web') {
        window.location.reload();
      } else if (Updates.isAvailable) {
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.error('Failed to reload app:', error);
    }
  };

  render() {
    if (this.state.hasError) {
      const isDev = __DEV__;
      
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>エラーが発生しました</Text>
            <Text style={styles.message}>
              申し訳ございません。アプリケーションでエラーが発生しました。
            </Text>
            
            {isDev && this.state.error && (
              <ScrollView style={styles.errorDetails}>
                <Text style={styles.errorTitle}>エラー詳細（開発モード）:</Text>
                <Text style={styles.errorText}>{this.state.error.message}</Text>
                {this.state.error.stack && (
                  <Text style={styles.stackText}>{this.state.error.stack}</Text>
                )}
              </ScrollView>
            )}
            
            <View style={styles.buttonContainer}>
              <Button 
                title="アプリを再起動" 
                onPress={this.handleReload}
                color="#3282b8"
              />
            </View>
            
            {!isDev && (
              <Text style={styles.hint}>
                問題が続く場合は、アプリを完全に終了してから再度起動してください。
              </Text>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    backgroundColor: '#0f3460',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#bbbbbb',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  hint: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    marginTop: 10,
  },
  errorDetails: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
    maxHeight: 200,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stackText: {
    fontSize: 10,
    color: '#888888',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});