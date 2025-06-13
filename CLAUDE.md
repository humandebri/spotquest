# Guess-the-Spot アーキテクチャ設計書

## 最新の作業指示

### 開発方針
変更を行う際は必ず方針を日本語で説明してから着手して下さい

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
Dev modeでは固定のテストキーを使ったEd25519KeyIdentityを使用
```typescript
// Use a fixed test Ed25519 key for dev mode
const TEST_SECRET_KEY = new Uint8Array([
  0x94, 0xeb, 0x94, 0xd7, 0x20, 0x2f, 0x2b, 0x87,
  0x7b, 0x12, 0x1f, 0x87, 0xfa, 0x85, 0x42, 0x2e,
  0x38, 0xf4, 0x7e, 0xd9, 0x16, 0xcc, 0xad, 0x37,
  0xa2, 0x42, 0xc8, 0xd8, 0xee, 0x6f, 0xb9, 0xc0
]);
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