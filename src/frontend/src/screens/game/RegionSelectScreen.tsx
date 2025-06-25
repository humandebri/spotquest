import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { photoServiceV2 } from '../../services/photoV2';
import { useAuth } from '../../hooks/useAuth';
import { matchesLocationSearch, getLocationLevel, extractCountryName } from '../../utils/regionMapping';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RegionSelect'>;

interface RegionInfo {
  code: string;
  name: string;
  photoCount: number;
  popularTags: string[];
  previewImage?: string;
}


export default function RegionSelectScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { identity } = useAuth();
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'country' | 'region'>('all');

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      setLoading(true);
      
      // Get photo statistics
      const stats = await photoServiceV2.getPhotoStats(identity || undefined);
      
      if (stats) {
        const regionData: RegionInfo[] = [];
        
        // Process countries (now using English names directly)
        stats.photosByCountry.forEach(([countryName, count]) => {
          if (Number(count) > 0) {
            regionData.push({
              code: countryName,
              name: countryName,
              photoCount: Number(count),
              popularTags: [],
            });
          }
        });
        
        // Process regions (now using English location names directly)
        console.log('🌏 photosByRegion data:', stats.photosByRegion);
        stats.photosByRegion.forEach(([locationName, count]) => {
          console.log('🌏 Processing region:', locationName, count);
          if (Number(count) > 0) {
            regionData.push({
              code: locationName,
              name: locationName,
              photoCount: Number(count),
              popularTags: [],
            });
          }
        });
        
        // Sort by photo count
        regionData.sort((a, b) => b.photoCount - a.photoCount);
        
        setRegions(regionData);
      }
    } catch (error) {
      console.error('Failed to load regions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRegions = regions.filter(region => {
    // 検索クエリによるフィルタリング（新しい検索機能を使用）
    if (searchQuery) {
      return matchesLocationSearch(searchQuery, region.name);
    }
    
    // カテゴリによるフィルタリング（地域レベルで判定）
    if (selectedCategory === 'country') {
      return getLocationLevel(region.name) === 'country';
    } else if (selectedCategory === 'region') {
      return getLocationLevel(region.name) !== 'country';
    }
    
    return true; // 'all' category
  });

  const handleRegionSelect = (region: RegionInfo) => {
    // Navigate to GamePlayScreen with region filter
    navigation.navigate('GamePlay', {
      mode: 'classic',
      regionFilter: region.code,
      regionName: region.name,
    });
  };

  const handleRandomSelect = () => {
    // Navigate without region filter (all regions)
    navigation.navigate('GamePlay', {
      mode: 'classic',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#0f1117']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>地域を選択</Text>
          <View style={styles.backButton} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="地域を検索..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          <TouchableOpacity
            style={[styles.categoryTab, selectedCategory === 'all' && styles.categoryTabActive]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[styles.categoryTabText, selectedCategory === 'all' && styles.categoryTabTextActive]}>
              すべて
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.categoryTab, selectedCategory === 'country' && styles.categoryTabActive]}
            onPress={() => setSelectedCategory('country')}
          >
            <Text style={[styles.categoryTabText, selectedCategory === 'country' && styles.categoryTabTextActive]}>
              国
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.categoryTab, selectedCategory === 'region' && styles.categoryTabActive]}
            onPress={() => setSelectedCategory('region')}
          >
            <Text style={[styles.categoryTabText, selectedCategory === 'region' && styles.categoryTabTextActive]}>
              地域
            </Text>
          </TouchableOpacity>
        </View>

        {/* Random Selection Card */}
        <TouchableOpacity
          style={styles.randomCard}
          onPress={handleRandomSelect}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53']}
            style={styles.randomGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="shuffle" size={32} color="#fff" />
            <View style={styles.randomInfo}>
              <Text style={styles.randomTitle}>ランダム選択</Text>
              <Text style={styles.randomSubtitle}>すべての地域から出題</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Region List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>地域情報を読み込み中...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.regionList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.regionListContent}
          >
            {filteredRegions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>
                  {searchQuery ? '検索結果がありません' : '利用可能な地域がありません'}
                </Text>
              </View>
            ) : (
              filteredRegions.map((region) => (
                <TouchableOpacity
                  key={region.code}
                  style={styles.regionCard}
                  onPress={() => handleRegionSelect(region)}
                >
                  <View style={styles.regionCardContent}>
                    <View style={styles.regionIcon}>
                      <Ionicons name="location" size={24} color="#4ECDC4" />
                    </View>
                    <View style={styles.regionInfo}>
                      <Text style={styles.regionName}>{region.name}</Text>
                      <Text style={styles.regionCode}>{region.code}</Text>
                      <Text style={styles.photoCount}>{region.photoCount} 枚の写真</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#666" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 16,
  },
  categoryTabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  categoryTabActive: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  categoryTabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTabTextActive: {
    color: '#4ECDC4',
  },
  randomCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  randomGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  randomInfo: {
    flex: 1,
    marginLeft: 16,
  },
  randomTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  randomSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  regionList: {
    flex: 1,
  },
  regionListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  regionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  regionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  regionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  regionInfo: {
    flex: 1,
  },
  regionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  regionCode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  photoCount: {
    fontSize: 14,
    color: '#4ECDC4',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
});