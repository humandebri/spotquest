import React, { Component, ReactNode } from 'react';
import { View, Text, Button, Platform } from 'react-native';
import { clearAllIIData } from '../utils/clearAllIIData';
import { getSecureStorage, getRegularStorage } from '../storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isResetting: boolean;
}

export class IIErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isResetting: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('🔥 Error boundary caught:', error);
    
    // Check if it's an II integration related error
    if (error.message && (
      error.message.includes('Deserialization error') ||
      error.message.includes('JSON must have at least 2 items') ||
      error.message.includes('expo-ii-integration') ||
      error.message.includes('Ed25519KeyIdentity')
    )) {
      return { hasError: true, error, isResetting: false };
    }
    
    // Re-throw other errors
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🔥 Error details:', error, errorInfo);
  }

  handleReset = async () => {
    this.setState({ isResetting: true });
    
    try {
      console.log('🔄 Resetting all II data...');
      const secureStorage = getSecureStorage();
      const regularStorage = getRegularStorage();
      
      await clearAllIIData(secureStorage, regularStorage);
      
      // On web, reload the page
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.reload();
      } else {
        // On native, reset the error state to retry
        this.setState({ hasError: false, error: null, isResetting: false });
      }
    } catch (error) {
      console.error('🔄 Reset failed:', error);
      this.setState({ isResetting: false });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: 20,
          backgroundColor: '#f5f5f5'
        }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>
            Authentication Error
          </Text>
          <Text style={{ textAlign: 'center', marginBottom: 10, color: '#666' }}>
            There was an issue with the authentication system.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={{ 
              fontSize: 12, 
              color: '#999', 
              marginBottom: 20,
              fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
            }}>
              {this.state.error.message}
            </Text>
          )}
          <Button 
            title={this.state.isResetting ? "Resetting..." : "Reset & Retry"} 
            onPress={this.handleReset}
            disabled={this.state.isResetting}
          />
        </View>
      );
    }

    return this.props.children;
  }
}