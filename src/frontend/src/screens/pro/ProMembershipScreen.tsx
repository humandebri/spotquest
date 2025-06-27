import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../hooks/useAuth';
import { gameService } from '../../services/game';
import { CustomPrincipal } from '../../utils/principal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ProMembership'>;

export default function ProMembershipScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { principal, identity } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [proStatus, setProStatus] = useState<{
    isPro: boolean;
    expiryTime?: bigint;
    cost: bigint;
  } | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);

  useEffect(() => {
    loadProStatus();
    loadTokenBalance();
  }, [principal]);

  const loadProStatus = async () => {
    if (!principal) return;
    
    try {
      const status = await gameService.getProMembershipStatus(CustomPrincipal.fromText(principal.toString()));
      setProStatus(status);
    } catch (error) {
      console.error('Failed to load Pro status:', error);
    }
  };

  const loadTokenBalance = async () => {
    if (!principal) return;
    
    try {
      const balance = await gameService.getTokenBalance(CustomPrincipal.fromText(principal.toString()));
      setTokenBalance(balance);
    } catch (error) {
      console.error('Failed to load token balance:', error);
    }
  };

  const handlePurchase = async () => {
    if (!principal || !proStatus) return;

    setIsLoading(true);
    try {
      const result = await gameService.purchaseProMembership();
      
      if (result.ok) {
        Alert.alert(
          'Success!',
          'Welcome to Pro membership! You now have 5 plays per day.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        loadProStatus();
        loadTokenBalance();
      } else if (result.err) {
        Alert.alert('Error', result.err);
      }
    } catch (error) {
      console.error('Failed to purchase Pro membership:', error);
      Alert.alert('Error', 'Failed to purchase Pro membership');
    } finally {
      setIsLoading(false);
    }
  };

  const formatExpiryDate = (expiryTime: bigint) => {
    const date = new Date(Number(expiryTime) / 1000000); // Convert nanoseconds to milliseconds
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const displayBalance = Number(tokenBalance) / 100;
  const proPrice = proStatus ? Number(proStatus.cost) / 100 : 500;
  const canAfford = tokenBalance >= (proStatus?.cost || 0n);

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pro Membership</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Pro Status Card */}
          {proStatus?.isPro && proStatus.expiryTime && (
            <View style={styles.statusCard}>
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                style={styles.statusGradient}
              >
                <Ionicons name="star" size={32} color="#ffffff" />
                <Text style={styles.statusTitle}>You're a Pro Member!</Text>
                <Text style={styles.statusExpiry}>
                  Valid until {formatExpiryDate(proStatus.expiryTime)}
                </Text>
              </LinearGradient>
            </View>
          )}

          {/* Pro Benefits */}
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>Pro Benefits</Text>
            <View style={styles.benefit}>
              <Ionicons name="game-controller" size={24} color="#f59e0b" />
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>5 Plays Per Day</Text>
                <Text style={styles.benefitDescription}>
                  Get 2 extra plays daily (5 total instead of 3)
                </Text>
              </View>
            </View>
            <View style={styles.benefit}>
              <Ionicons name="time" size={24} color="#f59e0b" />
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>30 Days Duration</Text>
                <Text style={styles.benefitDescription}>
                  Your Pro membership lasts for a full month
                </Text>
              </View>
            </View>
            <View style={styles.benefit}>
              <MaterialCommunityIcons name="crown" size={24} color="#f59e0b" />
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Pro Badge</Text>
                <Text style={styles.benefitDescription}>
                  Show off your Pro status on leaderboards
                </Text>
              </View>
            </View>
          </View>

          {/* Purchase Card */}
          {!proStatus?.isPro && (
            <View style={styles.purchaseCard}>
              <Text style={styles.priceLabel}>Pro Membership Price</Text>
              <Text style={styles.price}>{proPrice} SPOT</Text>
              <Text style={styles.balanceLabel}>Your Balance: {displayBalance.toFixed(2)} SPOT</Text>
              
              <TouchableOpacity
                style={[styles.purchaseButton, !canAfford && styles.disabledButton]}
                onPress={handlePurchase}
                disabled={!canAfford || isLoading}
              >
                <LinearGradient
                  colors={canAfford ? ['#f59e0b', '#d97706'] : ['#4b5563', '#374151']}
                  style={styles.purchaseButtonGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="star" size={20} color="#ffffff" />
                      <Text style={styles.purchaseButtonText}>
                        {canAfford ? 'Purchase Pro Membership' : 'Insufficient Balance'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  statusCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statusGradient: {
    padding: 24,
    alignItems: 'center',
  },
  statusTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
  },
  statusExpiry: {
    color: '#fef3c7',
    fontSize: 16,
    marginTop: 8,
  },
  benefitsCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  benefitsTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  benefit: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  benefitText: {
    flex: 1,
    marginLeft: 16,
  },
  benefitTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  benefitDescription: {
    color: '#94a3b8',
    fontSize: 14,
  },
  purchaseCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  priceLabel: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 8,
  },
  price: {
    color: '#f59e0b',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  balanceLabel: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 20,
  },
  purchaseButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.6,
  },
  purchaseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  purchaseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});