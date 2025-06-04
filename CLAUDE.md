# Guess-the-Spot 実装計画

## プロジェクト概要
ICP上で動作する位置推理ゲーム。実写真と撮影方位から撮影地点を推理し、SPOTトークンで報酬を獲得。

## 詳細実装計画
詳細な12週間の実装計画は `implementation_plan.md` を参照してください。

## 実装計画（概要）

### フェーズ1: 基礎インフラ (4-6週間)

**1. SPOTトークン (ICRC-1)**
```motoko
// RewardMint.mo
actor RewardMint {
  private stable var balances = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
  private stable var totalSupply : Nat = 0;
  
  public shared(msg) func mint(to: Principal, amount: Nat) : async Result<Nat, Text> {
    // GameEngineのみmint可能
  };
}
```

**2. PhotoNFT (ICRC-7 + Stable Memory)**
- 256KB チャンク分割アルゴリズム
- stable memory直接操作でコスト最適化
- メタデータ: lat/lon/azim/timestamp/quality

### フェーズ2: コアゲームロジック (3-4週間)

**3. GameEngine**
```motoko
// ハーヴァシン距離計算
func calculateDistance(lat1: Float, lon1: Float, lat2: Float, lon2: Float) : Float {
  // Vincenty formula実装
};

// スコア計算
func calculateScore(distance: Float, azimuthError: Float) : Nat {
  let Sd = 1.0 - (distance - 25.0) / (1000.0 - 25.0);
  let Sphi = 1.0 - azimuthError / 30.0;
  return Int.abs(Float.toInt(100.0 * (Sd ** 1.3) * (Sphi ** 0.7)));
};
```

**4. ReputationOracle**
- 品質スコア更新 (α=0.8のEMA)
- soft-ban (Q<0.15) / hard-ban (Q<0.05)

### フェーズ3: フロントエンド (4-5週間)

**5. モバイルPWA**
```typescript
// 技術スタック
- Vite + React + TypeScript
- @dfinity/agent + @dfinity/auth-client
- Mapbox GL JS (地図UI)
- PWA機能 (Service Worker)
```

**6. 主要画面**
- 写真アップロード (EXIF抽出 + 位置情報)
- ゲームプレイ (地図ピン配置)
- リーダーボード & NFTギャラリー

### フェーズ4: セキュリティ & 最適化 (2-3週間)

**7. 不正対策**
- モバイルアプリ: SafetyNet/App Attest統合
- Perceptual Hash重複検出
- レート制限 & Sybil対策

### 実装優先順位

1. **MVP必須機能** (8週間)
   - 基本的なトークン/NFT機能
   - シンプルなゲームフロー
   - 最小限のUI

2. **品質向上** (4週間)
   - Reputation システム
   - セキュリティ強化
   - UX改善

3. **拡張機能** (継続的)
   - DAO機能
   - AR ヒント
   - マルチ言語対応

総開発期間: 約3-4ヶ月でMVPローンチ可能

## TODOリスト

1. 基礎インフラ構築: ICRC-1準拠のSPOTトークンCanister実装
2. PhotoNFT Canister: ICRC-7準拠NFT発行とstable memory写真保存機能
3. GameEngine Canister: ハーヴァシン距離計算とスコアリングロジック
4. ReputationOracle Canister: Quality Score計算とBAN判定システム
5. Canister間通信: inter-canister callsの実装とテスト
6. セキュリティ: GPS/方位検証システム（SafetyNet/App Attest連携）
7. フロントエンド基盤: React PWAセットアップとInternet Identity連携
8. 写真アップロードUI: チャンク分割とプログレス表示
9. ゲームプレイUI: 地図選択インターフェースとスコア表示
10. テストネットデプロイと統合テスト