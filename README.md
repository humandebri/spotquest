# SpotQuest - 位置推理ゲーム on ICP

写真と撮影方位から撮影地点を推理し、SPOTトークンで報酬を獲得するブロックチェーンゲーム。

## 🎮 ゲーム概要

- 📸 実写真の撮影地点を地図上で推理
- 🧭 撮影方位（コンパス方向）も推定
- 💰 正確な推理でSPOTトークンを獲得
- 🖼️ 写真アップロードで継続的な報酬

## 🏗️ アーキテクチャ

### Canisters

#### 個別Canister構成（開発用）
- **RewardMint**: ICRC-1準拠のSPOTトークン管理
- **PhotoNFT**: ICRC-7準拠の写真NFT発行・保存
- **GameEngine**: ゲームロジックとスコアリング
- **ReputationOracle**: 写真品質管理とBAN判定

#### 統合Canister構成（本番推奨）
- **Integrated**: すべての機能とフロントエンドを1つのcanisterに統合
  - ICRC-1/ICRC-7準拠のトークン・NFT機能
  - ゲームエンジンとレピュテーション管理
  - フロントエンドアセットの提供
  - Taggrプロジェクトと同様のアーキテクチャ

### 技術スタック
- Backend: Motoko (Internet Computer)
- Frontend: React + TypeScript + Vite
- Storage: ICP Stable Memory
- Map: Mapbox GL JS
- Auth: Internet Identity

## 🚀 セットアップ

### 必要環境
- Node.js v18+
- DFX v0.15+
- Rust (optional)

### インストール

#### 開発環境（個別Canister）
```bash
# Clone repository
git clone https://github.com/yourusername/guess-the-spot.git
cd guess-the-spot

# Install dependencies
npm install

# Start local replica
dfx start --clean

# Deploy canisters
dfx deploy

# Start frontend
npm run dev
```

#### 本番環境（統合Canister）
```bash
# Build frontend
cd src/frontend
npm run build
cd ../..

# Deploy integrated canister
dfx deploy integrated --network ic

# Upload frontend assets
./scripts/deploy-integrated.sh
./upload_assets.sh <canister-id>
```

## 🎯 主な機能

### プレイヤー向け
- 📍 地図上で撮影地点を推理
- 🧭 撮影方位を推定
- 🏆 リーダーボード
- 💼 SPOTトークン残高管理

### 写真投稿者向け
- 📤 GPS付き写真のアップロード
- 💰 プレイ回数に応じた報酬
- 📊 写真の品質スコア確認

## 📐 スコアリング

```
距離スコア: Sd = 1 - (d - 25m) / (1000m - 25m)
方位スコア: Sφ = 1 - φ / 30°
最終スコア: Score = 100 × Sd^1.3 × Sφ^0.7
```

## 🔒 セキュリティ

- GPS/方位データ検証
- Perceptual Hash重複検出
- Quality Scoreによる自動BAN
- SafetyNet/App Attest連携（予定）

## 📱 PWA対応

- オフライン動作
- プッシュ通知
- ホーム画面追加
- バックグラウンド同期

## 🧪 テスト

```bash
# Unit tests
dfx test

# Integration tests
./test/integration.test.sh

# Frontend tests
npm test
```

## 📄 ライセンス

MIT License

## 🤝 Contributing

プルリクエスト歓迎！

## 📞 サポート

- Issues: [GitHub Issues](https://github.com/yourusername/guess-the-spot/issues)
- Discord: [Join our community](#)