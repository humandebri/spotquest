import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { extractLocationFromExif, formatCoordinates, parseExifDateTime } from '../../utils/locationHelpers';

type DebugScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhotoLocationDebug'>;

interface DebugInfo {
  exifData: any;
  extractedLocation: { latitude: number; longitude: number } | null;
  mediaLibraryLocation: { latitude: number; longitude: number } | null;
  photoUri: string;
  errorMessages: string[];
}

export default function PhotoLocationDebugScreen() {
  const navigation = useNavigation<DebugScreenNavigationProp>();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testPhotoLocation = async () => {
    setIsLoading(true);
    setDebugInfo(null);
    
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('権限エラー', 'メディアライブラリへのアクセス権限が必要です。');
        setIsLoading(false);
        return;
      }

      // Pick image with EXIF data
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        exif: true,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) {
        setIsLoading(false);
        return;
      }

      const pickedPhoto = result.assets[0];
      const exif = (pickedPhoto as any).exif;
      const errorMessages: string[] = [];

      // Extract location from EXIF
      let extractedLocation = null;
      try {
        extractedLocation = extractLocationFromExif(exif);
        if (!extractedLocation) {
          errorMessages.push('EXIF data does not contain valid location information');
        }
      } catch (error) {
        errorMessages.push(`EXIF extraction error: ${error}`);
      }

      // Try MediaLibrary
      let mediaLibraryLocation = null;
      try {
        const fileName = pickedPhoto.uri.split('/').pop() || '';
        console.log('🔍 Searching MediaLibrary for:', fileName);
        
        // Search through MediaLibrary
        let matchingAsset = null;
        let hasNextPage = true;
        let endCursor = null;
        let pageCount = 0;
        const maxPages = 5;

        while (hasNextPage && !matchingAsset && pageCount < maxPages) {
          const assets = await MediaLibrary.getAssetsAsync({
            first: 20,
            mediaType: 'photo',
            sortBy: [MediaLibrary.SortBy.creationTime],
            after: endCursor,
          });

          matchingAsset = assets.assets.find(asset => 
            asset.uri === pickedPhoto.uri || 
            asset.filename === fileName
          );

          hasNextPage = assets.hasNextPage;
          endCursor = assets.endCursor;
          pageCount++;
        }

        if (matchingAsset) {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(matchingAsset.id);
          if ((assetInfo as any).location) {
            mediaLibraryLocation = (assetInfo as any).location;
          } else {
            errorMessages.push('MediaLibrary asset has no location data');
          }
        } else {
          errorMessages.push('Could not find matching asset in MediaLibrary');
        }
      } catch (error) {
        errorMessages.push(`MediaLibrary error: ${error}`);
      }

      setDebugInfo({
        exifData: exif,
        extractedLocation,
        mediaLibraryLocation,
        photoUri: pickedPhoto.uri,
        errorMessages,
      });

    } catch (error) {
      Alert.alert('エラー', `テスト中にエラーが発生しました: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatExifData = (exif: any): string => {
    if (!exif) return 'No EXIF data';
    
    try {
      return JSON.stringify(exif, null, 2);
    } catch (error) {
      return `Error formatting EXIF: ${error}`;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LinearGradient colors={['#1a1a2e', '#0f1117']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Location Debug Tool</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Test Button */}
          <TouchableOpacity
            style={styles.testButton}
            onPress={testPhotoLocation}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="bug" size={24} color="#fff" />
                <Text style={styles.testButtonText}>Test Photo Location</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Debug Results */}
          {debugInfo && (
            <View style={styles.debugContainer}>
              {/* Photo Preview */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Selected Photo</Text>
                <Image source={{ uri: debugInfo.photoUri }} style={styles.photoPreview} />
              </View>

              {/* Location Results */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location Extraction Results</Text>
                
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>EXIF Location:</Text>
                  <Text style={[styles.resultValue, debugInfo.extractedLocation ? styles.success : styles.error]}>
                    {debugInfo.extractedLocation 
                      ? formatCoordinates(debugInfo.extractedLocation.latitude, debugInfo.extractedLocation.longitude)
                      : 'Not found'}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>MediaLibrary Location:</Text>
                  <Text style={[styles.resultValue, debugInfo.mediaLibraryLocation ? styles.success : styles.error]}>
                    {debugInfo.mediaLibraryLocation 
                      ? formatCoordinates(debugInfo.mediaLibraryLocation.latitude, debugInfo.mediaLibraryLocation.longitude)
                      : 'Not found'}
                  </Text>
                </View>
              </View>

              {/* Errors */}
              {debugInfo.errorMessages.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Errors</Text>
                  {debugInfo.errorMessages.map((error, index) => (
                    <Text key={index} style={styles.errorMessage}>• {error}</Text>
                  ))}
                </View>
              )}

              {/* Raw EXIF Data */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Raw EXIF Data</Text>
                <ScrollView horizontal style={styles.exifScroll}>
                  <Text style={styles.exifData}>{formatExifData(debugInfo.exifData)}</Text>
                </ScrollView>
              </View>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultLabel: {
    color: '#aaa',
    fontSize: 14,
    width: 150,
  },
  resultValue: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  success: {
    color: '#4CAF50',
  },
  error: {
    color: '#FF5252',
  },
  errorMessage: {
    color: '#FF5252',
    fontSize: 14,
    marginBottom: 4,
  },
  exifScroll: {
    maxHeight: 300,
  },
  exifData: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 8,
  },
});