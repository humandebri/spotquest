# 📱 スマートフォンテスト手順

## 問題
Metro Bundlerが正常に起動しないため、通常のExpo開発サーバーが使用できません。

## 解決策

### 🚀 方法1: Expo Snack（推奨）

1. **ブラウザで開く**: https://snack.expo.dev

2. **以下のコードをコピー＆ペースト**:

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🌍 Guess the Spot</Text>
        <Text style={styles.subtitle}>テストアプリ</Text>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={() => {
            setCount(count + 1);
            Alert.alert('Success!', `ボタンが押されました！カウント: ${count + 1}`);
          }}
        >
          <Text style={styles.buttonText}>テストボタン ({count})</Text>
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
```

3. **右側のパネルで「My Device」タブを選択**

4. **QRコードをスキャン**（Expo Goアプリで）

### 🛠️ 方法2: Metro Bundlerの修復

1. **Watchmanをインストール**（Homebrewが必要）:
```bash
brew install watchman
```

2. **キャッシュを完全にクリア**:
```bash
cd /Users/0xhude/Desktop/ICP/Guess-the-Spot/src/frontend
watchman watch-del-all
rm -rf node_modules
rm -rf .expo
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*
npm install
```

3. **再度起動**:
```bash
npx expo start --clear
```

### 📲 方法3: 実機ビルド（iOSの場合）

1. **EAS CLIをインストール**:
```bash
npm install -g eas-cli
```

2. **EASでビルド**:
```bash
eas build --platform ios --profile development
```

## 📋 テストチェックリスト

- [ ] React Nativeが動作することを確認
- [ ] ボタンタップでアラートが表示される
- [ ] カウンターが増加する
- [ ] スタイルが正しく適用されている

## 🎮 フルアプリのテスト

上記の基本テストが成功したら、フルアプリのコードもExpo Snackで試すことができます。

### GamePlayScreenのテスト用コード（Snack用に簡略化）

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

export default function GamePlayScreen() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showHint, setShowHint] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Photo Section */}
        <View style={styles.photoSection}>
          <Text style={styles.title}>どこで撮影された写真でしょうか？</Text>
          <Image
            source={{ uri: 'https://picsum.photos/400/300' }}
            style={styles.photo}
          />
        </View>

        {/* Hint Button */}
        <TouchableOpacity
          style={styles.hintButton}
          onPress={() => setShowHint(!showHint)}
        >
          <Text style={styles.hintButtonText}>
            ヒントを見る {showHint ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showHint && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              🌏 地域: アジア太平洋地域
            </Text>
            <Text style={styles.hintText}>
              🌡️ 気候: 温帯気候
            </Text>
          </View>
        )}

        {/* Map Section */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: 35.6812,
              longitude: 139.7671,
              latitudeDelta: 10,
              longitudeDelta: 10,
            }}
            onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)}
          >
            {selectedLocation && (
              <Marker coordinate={selectedLocation} />
            )}
          </MapView>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            !selectedLocation && styles.submitButtonDisabled,
          ]}
          disabled={!selectedLocation}
        >
          <Text style={styles.submitButtonText}>
            {selectedLocation ? '推測を送信' : 'マップをタップして場所を選択'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  photoSection: {
    padding: 20,
  },
  title: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  photo: {
    width: '100%',
    height: 250,
    borderRadius: 12,
  },
  hintButton: {
    backgroundColor: '#1a1a2e',
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  hintButtonText: {
    color: '#3282b8',
    fontSize: 16,
  },
  hintBox: {
    backgroundColor: '#1a1a2e',
    padding: 15,
    margin: 20,
    borderRadius: 8,
  },
  hintText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  mapContainer: {
    height: 300,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#3282b8',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#1a1a2e',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```

## 💡 トラブルシューティング

### エラー: Metro Bundlerが起動しない
- Watchmanをインストール
- Node.jsを再インストール（v18またはv20）
- ファイアウォール設定を確認

### エラー: ポート8081が使用中
```bash
lsof -ti:8081 | xargs kill -9
```

### エラー: 権限エラー
```bash
sudo chown -R $(whoami) /Users/0xhude/Desktop/ICP/Guess-the-Spot
```

---

**推奨**: まずはExpo Snackで基本動作を確認してから、ローカル環境の問題を解決することをお勧めします。