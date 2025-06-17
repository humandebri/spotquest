# 写真位置情報デバッグガイド

## 問題の概要
PhotoLibraryScreenで、iPhoneのギャラリーから選択した写真から位置情報（GPS座標）を抽出できない問題

## 改善内容

### 1. EXIF GPS座標の解析強化
- DMS（度分秒）形式のGPS座標をDecimal形式に変換する関数を実装
- 様々なEXIFフィールドパターンに対応（GPSLatitude、gpsLatitude、latitude等）
- GPS座標の参照方向（N/S/E/W）を考慮した符号処理

### 2. MediaLibrary検索の改善
- 検索上限を250枚から500枚に拡張
- ファイル名の拡張子を除いたマッチング
- 作成時間による二次マッチング（5秒以内）
- getAssetInfoAsync()を使用した詳細情報取得

### 3. デバッグツールの追加
- PhotoLocationDebugScreen: 位置情報抽出をテストする専用画面
- 詳細なログ出力（EXIF全データ、MediaLibrary検索結果）
- Dev modeでHome画面からアクセス可能

### 4. ヘルパー関数の整理
- locationHelpers.ts: 位置情報処理の共通ロジックを分離
- extractLocationFromExif(): EXIF解析の統一処理
- matchAssetWithPickedPhoto(): アセットマッチングロジック

## テスト方法

### 1. デバッグ画面でテスト
```bash
# Dev modeで起動
npm start

# Home画面 → "Location Debug" → "写真をテスト"
```

### 2. 通常のフローでテスト
```bash
# Home画面 → "Take Photo" → "ギャラリーから選択" → 写真を選択
```

## 位置情報が取得できない原因

### iOS/iPhoneの場合
1. **プライバシー設定**
   - 設定 → プライバシー → 位置情報サービス → カメラ → 「常に」または「使用中」
   - 設定 → プライバシー → 写真 → "Guess the Spot" → 「すべての写真」

2. **写真の撮影設定**
   - カメラアプリの設定で位置情報がオフ
   - 機内モードやGPSが無効な状態で撮影

3. **写真の共有設定**
   - 写真を共有する際に位置情報を削除する設定が有効
   - iCloudフォトライブラリの最適化により元データが削除

### Androidの場合
1. **権限設定**
   - アプリの権限で位置情報と写真へのアクセスを許可
   - MediaLibraryの権限が制限されている

2. **Exif情報の保存**
   - カメラアプリによってはExif情報を保存しない
   - Android版によってはExif APIの実装が異なる

## トラブルシューティング

### 1. EXIF情報が見つからない
```javascript
// デバッグ画面で以下を確認
📸 EXIF data: null または {}
```
→ 写真にEXIF情報が含まれていない

### 2. GPS座標が変換できない
```javascript
// DMS形式の例
GPSLatitude: [35, 39, 29.52]
GPSLongitude: [139, 44, 28.86]
```
→ 新しい解析関数で対応済み

### 3. MediaLibraryで写真が見つからない
```javascript
❌ MediaLibraryで写真が見つかりませんでした
```
→ 権限設定を確認、またはファイル名/作成時間でマッチング改善

## 今後の改善案

1. **HEIC形式対応**
   - iPhoneのデフォルト形式HEICからのメタデータ抽出

2. **キャッシュ機能**
   - 一度解析した写真の位置情報をキャッシュ

3. **バッチ処理**
   - 複数写真の一括位置情報取得

4. **サードパーティライブラリ**
   - react-native-exifやpiexifjsの導入検討