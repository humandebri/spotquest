# Guess-the-Spot アーキテクチャ設計書

## 最新の作業指示

### 開発方針
変更を行う際は必ず方針を日本語で説明してから着手して下さい

## 🔄 最新の作業状況 (2025-06-14 PM) - Photo V2への完全移行とデプロイ完了 ✅

### Photo V1からV2への完全移行
**実施内容**:
1. **バックエンド変更**:
   - Photo V1関連のすべての参照を削除
   - `getPhotoFromEitherSystem`を`getPhotoFromV2System`に変更（V1フォールバック削除）
   - `getNextRound`でPhoto V2のみを使用
   - `updatePhotoInfo`機能をPhotoModuleV2に実装
   - 予約投稿機能をPhotoModuleV2に実装：
     - `schedulePhotoUpload`: 写真の予約投稿作成
     - `getScheduledPhotos`: ユーザーの予約投稿取得
     - `cancelScheduledPhoto`: 予約投稿キャンセル
     - `processScheduledPhotos`: 時間になった写真を自動公開

2. **フロントエンド変更**:
   - `photoV2.ts`にScheduledPhoto型とAPIメソッドを追加
   - IDLファクトリーにScheduledPhoto関連の定義を追加
   - ScheduledPhotosScreenを完全にPhoto V2に移行：
     - インポートを`photoService`から`photoServiceV2`に変更
     - ScheduledPhoto型の構造変更に対応（`item.title` → `item.request.title`など）
     - difficulty表示の修正（Variant型への対応）
   - ProfileScreenで`getDifficulty`ヘルパー関数を改善

3. **削除されたもの**:
   - Photo V1 APIへのすべての参照とフォールバック
   - 段階的移行のための冗長なコード
   - `uploadPhoto`、`deletePhoto`のV1エンドポイント（エラーメッセージでV2を促す）

**Photo V2の利点**:
- 検索ファースト設計（GeoHash、国、地域、シーンタイプ、タグによる検索）
- チャンクベースアップロード（大容量ファイルサポート）
- 予約投稿機能の統合
- より詳細なメタデータ管理

**完了作業**:
- ✅ メインネットへのバックエンドデプロイ（dfx deploy --network ic） - 2025-06-14 完了
  - PhotoModuleV2のコンパイルエラーを修正（798行目）
  - Stable storage互換性問題を解決（photoV2ScheduledStableを別変数として追加）
  - メインネットへのデプロイ成功：
    - unified: 77fv5-oiaaa-aaaal-qsoea-cai
    - フロントエンド: https://7yetj-dqaaa-aaaal-qsoeq-cai.icp0.io/
    - バックエンドCandid: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=77fv5-oiaaa-aaaal-qsoea-cai
- ✅ 既存のPhoto V1データをV2にマイグレーション（戦略策定完了） - 実装待ち

## 🔄 既存写真データのマイグレーション戦略

### マイグレーション方針
**目的**: 既存のPhoto V1データをPhoto V2形式に移行し、検索機能とチャンクアップロードに対応

**アプローチ**: 
1. **段階的マイグレーション** - システム稼働を維持しながら順次移行
2. **データ整合性確保** - 移行中もゲームが正常に動作することを保証
3. **ロールバック可能** - 問題発生時に元に戻せる設計

### マイグレーション手順

#### 1. 準備フェーズ
```motoko
// main.moに一時的なマイグレーション関数を追加
public shared(msg) func migratePhotoToV2(photoId: Nat) : async Result.Result<Nat, Text> {
    if (msg.caller != owner) {
        return #err("Unauthorized");
    };
    
    // V1から写真を取得
    switch(photoManager.getPhoto(photoId)) {
        case null { #err("Photo not found in V1") };
        case (?photoV1) {
            // V2形式に変換
            let request : Photo.CreatePhotoRequest = {
                latitude = photoV1.lat;
                longitude = photoV1.lon;
                azimuth = ?photoV1.azim;
                title = "Migrated Photo #" # Nat.toText(photoId);
                description = "";
                difficulty = #NORMAL;
                hint = "";
                country = "XX"; // デフォルト値
                region = "XX-XX";
                sceneKind = #Other;
                tags = [];
                expectedChunks = photoV1.chunkCount;
                totalSize = photoV1.totalSize;
            };
            
            // V2に作成
            switch(photoManagerV2.createPhoto(request, photoV1.owner)) {
                case (#err(e)) { #err(e) };
                case (#ok(newPhotoId)) {
                    // チャンクをコピー
                    for (i in Iter.range(0, photoV1.chunkCount - 1)) {
                        switch(photoManager.getPhotoChunk(photoId, i)) {
                            case null { };
                            case (?chunk) {
                                ignore photoManagerV2.uploadPhotoChunk(newPhotoId, i, chunk);
                            };
                        };
                    };
                    
                    // アップロード完了
                    ignore photoManagerV2.finalizePhotoUpload(newPhotoId);
                    
                    // V1の写真をマーク（削除はしない）
                    ignore photoManager.markAsMigrated(photoId);
                    
                    #ok(newPhotoId)
                };
            };
        };
    };
};
```

#### 2. バッチマイグレーション関数
```motoko
public shared(msg) func migratePhotoBatch(start: Nat, count: Nat) : async {
    success: Nat;
    failed: Nat;
    errors: [Text];
} {
    if (msg.caller != owner) {
        return { success = 0; failed = 0; errors = ["Unauthorized"] };
    };
    
    var successCount = 0;
    var failedCount = 0;
    var errors = Buffer.Buffer<Text>(10);
    
    for (i in Iter.range(start, start + count - 1)) {
        switch(await migratePhotoToV2(i)) {
            case (#ok(_)) { successCount += 1; };
            case (#err(e)) { 
                failedCount += 1;
                errors.add("Photo " # Nat.toText(i) # ": " # e);
            };
        };
    };
    
    {
        success = successCount;
        failed = failedCount;
        errors = Buffer.toArray(errors);
    }
};
```

#### 3. マイグレーション実行計画
1. **テスト環境での検証**
   - 少数の写真（10-20枚）でテスト
   - マイグレーション後の動作確認

2. **本番環境での段階的実行**
   - 100枚ずつバッチ処理
   - 各バッチ後に動作確認
   - エラー率が5%を超えたら停止

3. **検証項目**
   - ✅ 写真メタデータの整合性
   - ✅ チャンクデータの完全性
   - ✅ ゲームでの写真表示
   - ✅ 所有者情報の保持

#### 4. ロールバック計画
- V1データは削除せず、`migrated`フラグで管理
- 問題発生時はV2データを削除してV1に戻す
- マイグレーション完了後1週間はV1データを保持

### マイグレーション後の対応
1. **データ検証**
   - 全写真の表示テスト
   - ゲームプレイテスト
   - パフォーマンス測定

2. **V1システムの削除**
   - マイグレーション完了確認後
   - PhotoModuleの削除
   - 関連するstable変数の削除

3. **ユーザー通知**
   - マイグレーション完了のアナウンス
   - 新機能（検索、タグ付け）の案内

## 🔄 最新の作業状況 (2025-06-14) - Photo V2 API実装完了 ✅

### Photo V2 実装状況
**背景**: 検索機能と大容量写真対応のため、写真管理システムをV1からV2へ移行

**実装内容**:
1. **バックエンド実装** ✅
   - PhotoModuleV2: 検索対応の新写真管理システム
   - チャンクアップロード対応（256KB単位）
   - セカンダリインデックス（国、地域、シーン、タグ、GeoHash）
   - 検索API（複数フィルター対応）
   - Haversine距離計算による近傍検索

2. **フロントエンド移行** ✅
   - **PhotoUploadScreenV2**: 完全にV2 APIに移行
     - 国・地域自動検出（Nominatim API使用）
     - シーンタイプ選択UI（自然/建物/店舗/施設/その他）
     - チャンクアップロード進捗表示
   - **ProfileScreen**: V2 APIに移行
     - getUserPhotosV2使用
     - PhotoMetaV2型対応
   - **ナビゲーション**: PhotoUploadScreenV2を使用
   - 旧PhotoUploadScreen.tsxを削除

3. **ゲームシステム統合** ✅
   - getNextRound: V2優先でV1フォールバック
   - submitGuess: 両システム対応
   - getPhotoFromEitherSystemヘルパー関数

**新しいAPIエンドポイント**:
- `createPhotoV2`: 写真メタデータ作成
- `uploadPhotoChunkV2`: チャンクアップロード  
- `finalizePhotoUploadV2`: アップロード完了
- `searchPhotosV2`: 高度な検索
- `getPhotoMetadataV2`: 拡張メタデータ取得
- `getPhotoStatsV2`: 統計情報取得
- `getUserPhotosV2`: ユーザー写真取得
- `deletePhotoV2`: 写真削除

**バグ修正**:
1. **ProfileScreen null安全性** ✅
   ```typescript
   // 修正前
   photo.latitude.toFixed(4)
   // 修正後
   photo.latitude?.toFixed(4) ?? 'N/A'
   ```

2. **PhotoModuleV2ランダム性向上** ✅
   ```motoko
   // 時間の複数コンポーネントを組み合わせ
   let randomIndex = (nanoComponent + microComponent + milliComponent + photoCount) % photoCount;
   ```

3. **コード重複の解消** ✅
   ```motoko
   private func getPhotoFromEitherSystem(photoId: Nat) : ?{ 
       owner: Principal; 
       latitude: Float; 
       longitude: Float 
   }
   ```

**保留事項**:
- ⏸️ ScheduledPhotosScreen: V2未対応のため移行保留
- 📋 updatePhotoInfo: バックエンドV2実装待ち
- 🚀 バックエンドデプロイ: 実装完了後に必要

**重要な変更点**:
- Photo V1とV2の併存（段階的移行）
- フロントエンドは基本的にV2を使用
- ゲームシステムは両方に対応（互換性維持）

**デプロイ済み** (2025-06-14): 77fv5-oiaaa-aaaal-qsoea-cai

## 🔄 最新の作業状況 (2025-06-13) - Dev Mode完全動作実現 🎉

### 重要な開発指示
- モックコードは決して追加しないでください（ただしDev modeの証明書エラー回避時のみ例外）
- ローカルレプリカは使用しないでください

### Certificate Verification Error & "unreachable" エラーの原因 🔍
**問題**: Dev modeでメインネットキャニスター(77fv5-oiaaa-aaaal-qsoea-cai)にアクセス時に「unreachable」エラーが発生

**根本原因**:
- **WebAssembly依存問題**: @dfinity/principal と @dfinity/agent がWebAssemblyモジュールを使用
- **React Native制限**: React NativeはWebAssemblyをサポートしていない
- Principal.fromText()の実行時に「unreachable」エラーが発生
- CBORエンコーディング時にもWebAssemblyが使用される

**詳細な原因分析**:
1. @dfinity/principal (v0.21.4) は内部でWebAssemblyを使用してPrincipalの解析を行う
2. React Native環境では`global.WebAssembly`が未定義
3. WebAssemblyモジュールの実行時に「unreachable」命令に到達してエラー

**調査済みアプローチ**:
- ❌ WebAssemblyのpolyfill追加（React Nativeでは動作しない）
- ❌ earlyPatches.tsでのライブラリパッチ（WebAssembly依存は根本的に解決できない）
- ❌ 証明書検証のバイパス（「unreachable」エラーは証明書検証前に発生）

**解決方法** (2025-06-13) ✅:
カスタムPrincipal実装 + 証明書検証パッチによりWebAssembly依存を完全に解決

```typescript
// src/frontend/src/utils/principal.ts - 独自のPrincipal実装
export class CustomPrincipal {
  static fromText(text: string): CustomPrincipal {
    // Pure JavaScript implementation using CRC32 and Base32
    // No WebAssembly dependency
  }
  
  toText(): string {
    // Reverse conversion with CRC32 checksum validation
  }
}

// src/frontend/src/utils/earlyPatches.ts - 証明書検証を無効化
agentModule.Certificate = class MockCertificate {
  verify() { return true; }
  lookup(path) { return [new TextEncoder().encode('replied')]; }
};
```

**実装済みファイル**:
- ✅ `src/frontend/src/utils/principal.ts` - WebAssembly不要のPrincipal実装
- ✅ `src/frontend/src/utils/earlyPatches.ts` - 証明書検証を完全無効化
- ✅ `src/frontend/src/services/game.ts` - カスタムPrincipalを使用
- ✅ 動作テスト完了: Principal作成成功（3pkv4-md3ar...）

**重要事項**:
- **Phase 1**: WebAssemblyなしでPrincipal実装（✅完了）
- **Phase 2**: 証明書検証を安全にバイパス（実装中）
- Dev modeでメインネットキャニスターへの接続が可能
- 実際のトランザクション送信とゲーム動作をテスト可能

### HomeScreen統計情報とランキング機能実装 ✅
**実装内容**:
1. **Win Rate → Avg Score (30日平均)への変更**
   - バックエンドで30日以内のセッションをフィルタリング
   - `averageScore30Days`フィールドを追加
   - プレイヤーの最近の安定性とスキル向上を表示

2. **ランキング機能（ベストスコア順）の実装**
   - `getPlayerRank(Principal): ?Nat` - プレイヤーの現在順位
   - `getLeaderboard(Nat): [(Principal, Nat)]` - トップN位のプレイヤー
   - 全プレイヤーのベストスコアでソート（降順）

**バックエンド実装**:
- `main.mo`: 30日平均計算とランキング関数を追加
- `GameEngineModule.mo`: `getPlayerSessionsMap()`メソッドを追加
- IDL定義: `averageScore30Days`と`rank`フィールドを追加

**フロントエンド実装**:
- HomeScreen: Win Rate → Avg Scoreに表示変更
- ランキング: "Unranked" → "#42"形式で表示
- trending-up-outlineアイコンを追加

**表示される統計情報**:
- Games: 完了したゲームセッション数
- Photos: アップロードした写真数  
- Rank: ベストスコア順のランキング順位
- Avg Score: 過去30日間の平均スコア

### エラー修正記録（2025-06-12）

#### 1. averageScore30Days フィールドエラー ✅
**問題**: `Cannot find required field averageScore30Days`
**原因**: フロントエンドIDLで必須フィールドとして定義していたが、バックエンドは値がない場合がある
**修正**: 
- フロントエンドIDL: `IDL.Opt(IDL.Nat)`に変更（オプション型）
- バックエンド: 30日以内のゲームがない場合は`null`を返すように修正
- 表示処理: `playerStats.averageScore30Days?.[0]`で安全にアクセス

#### 2. 秘密鍵が全て0になる問題 ⚠️
**症状**: `"0000000000000000000000000000000000000000000000000000000000000000"`
**原因**: 調査中（Ed25519KeyIdentity生成の問題の可能性）
**暫定対応**: Dev mode固定シード（1,2,3,4...）を使用しているが、正常に動作していない可能性

#### 3. Certificate verification エラー
**既存の解決方法**: `verifyQuerySignatures: false`を設定（既に実装済み）

## 🔄 最新の作業状況 (2025-06-13) - Ed25519KeyIdentity生成問題への対応

### 重要な学び：Dev modeは固定テストキーで十分 ✨

**気づき**：
- Dev modeは開発・テスト専用なので、複雑な動的キー生成は不要
- 固定テストキーを使うことで、Expo Goの制限を回避し確実に動作
- ビルドしたアプリでは元々問題ないので、開発環境に特化した解決策で良い

**アンチパターンから学んだこと**：
- ❌ 複雑なパッチやpolyfillで無理やり解決しようとした
- ❌ あらゆる環境で動的生成することにこだわりすぎた
- ✅ 要件を整理し、目的に応じた最適解を選択すべき

**設計原則**：
1. **YAGNI (You Aren't Gonna Need It)** - 不要な汎用化は避ける
2. **適材適所** - 開発環境と本番環境で異なる実装でOK
3. **シンプルファースト** - まず最もシンプルな解決策を検討

### Ed25519KeyIdentity生成問題（2025-06-13） ✅
**問題**: Expo Go環境でEd25519KeyIdentityを生成すると秘密鍵が全て0になる

**症状**:
- `keyPair.publicKey.slice is not a function`エラー
- 秘密鍵が"0000000000000000000000000000000000000000000000000000000000000000"になる
- `private key of length 32 expected, got 121`エラー
- Dev loginが失敗する

**原因**:
- Expo Go環境でのcrypto APIの制限
- expo-cryptoのgetRandomBytesが正しく動作しない可能性
- Ed25519KeyIdentity.fromParsedJsonの使い方の誤り

**最終的な解決策** ✅:
Dev modeでは決定論的に生成されるテストキーを使用
```typescript
// Generate a deterministic test key based on a fixed seed
const generateTestKey = (): Uint8Array => {
  const FIXED_SEED = 'guess-the-spot-dev-mode-test-key-2024';
  // Hash function to generate consistent 32 bytes
  const key = new Uint8Array(32);
  // ... deterministic key generation logic ...
  return key;
};
const TEST_SECRET_KEY = generateTestKey();
const identity = Ed25519KeyIdentity.fromSecretKey(TEST_SECRET_KEY.buffer);
```

**なぜこの解決策が最適か**:
- Dev modeは開発・テスト専用なので固定キーで十分
- Expo Goの動的キー生成の制限を完全に回避
- トークンテストなど、実際のIdentityが必要な機能に対応
- 複雑なキー生成やパッチが一切不要
- エラーが発生する可能性が低い
- コードがシンプルで理解しやすい

**実装済み**:
- ✅ `DevAuthContext.tsx`: 固定テストキーのEd25519KeyIdentityを使用
- ✅ `earlyPatches.ts`: 複雑なパッチを削除
- ✅ `polyfills.ts`: シンプル化
- ✅ 正しい32バイトのシークレットキーを使用

[以下、既存の内容は省略せず維持]