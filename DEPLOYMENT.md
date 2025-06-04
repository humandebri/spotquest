# Guess-the-Spot デプロイメントガイド

## 概要
本ドキュメントでは、Guess-the-Spotを本番環境（ICPメインネット）にデプロイする手順を説明します。

## デプロイアーキテクチャ
本番環境では、すべての機能を統合した単一canister構成を使用します。これにより：
- canister間通信のコストを削減
- 管理の簡素化
- フロントエンドとバックエンドの統合

## 前提条件
- DFX v0.15以上がインストールされていること
- ICPアカウントとcyclesが準備されていること
- Node.js v18以上がインストールされていること

## デプロイ手順

### 1. プロジェクトのビルド

```bash
# フロントエンドのビルド
cd src/frontend
npm install
npm run build
cd ../..
```

### 2. Cycles Walletの準備

```bash
# Cycles walletの確認
dfx wallet --network ic balance

# 必要に応じてcyclesを追加
dfx wallet --network ic add-cycles <amount>
```

### 3. 統合Canisterのデプロイ

```bash
# メインネットにデプロイ
dfx deploy integrated --network ic --with-cycles 1_000_000_000_000

# Canister IDを記録
dfx canister --network ic id integrated
```

### 4. フロントエンドアセットのアップロード

```bash
# アセットアップロードスクリプトの実行
./scripts/deploy-integrated.sh

# 生成されたスクリプトを実行（Canister IDを指定）
./upload_assets.sh <integrated-canister-id>
```

### 5. 環境設定の更新

```bash
# フロントエンドの環境変数を更新
echo "VITE_CANISTER_ID=<integrated-canister-id>" > src/frontend/.env.production
echo "VITE_HOST=https://ic0.app" >> src/frontend/.env.production
```

### 6. 動作確認

```bash
# ブラウザでアクセス
open https://<integrated-canister-id>.ic0.app
```

## セキュリティ設定

### Admin Principal の設定
デプロイ後、必ずadmin principalを更新してください：

```bash
dfx canister --network ic call integrated setAdmin '(principal "<your-principal>")'
```

### アクセス制御
- アセットアップロード機能は管理者のみ
- mint権限はGameEngine機能内でのみ
- 写真アップロードは認証済みユーザーのみ

## 監視とメンテナンス

### Canisterの状態確認
```bash
# Cycles残高確認
dfx canister --network ic status integrated

# メモリ使用量確認
dfx canister --network ic call integrated getMemoryStats
```

### アップグレード手順
```bash
# 新バージョンのビルド
npm run build

# Canisterのアップグレード
dfx canister --network ic install integrated --mode upgrade
```

## トラブルシューティング

### よくある問題

1. **Cycles不足エラー**
   ```bash
   dfx wallet --network ic add-cycles 10_000_000_000_000
   ```

2. **アセットアップロード失敗**
   - ファイルサイズが大きすぎる場合は分割
   - content-typeが正しく設定されているか確認

3. **CORS エラー**
   - integrated canisterのHTTPレスポンスヘッダーを確認
   - `Access-Control-Allow-Origin: *` が設定されているか

## コスト見積もり

- 初期デプロイ: ~1T cycles
- 月間運用コスト:
  - ストレージ: 1GB あたり ~0.4T cycles/月
  - 計算: アクティブユーザー1000人で ~0.5T cycles/月
  - 合計: ~1T cycles/月（約$1.3 USD）

## バックアップとリカバリ

### 定期バックアップ
```bash
# stable memoryのバックアップ
dfx canister --network ic call integrated exportData > backup_$(date +%Y%m%d).json
```

### リカバリ手順
```bash
# 新しいcanisterにデータをインポート
dfx canister --network ic call integrated importData < backup_20250604.json
```

## 本番環境のベストプラクティス

1. **監視**: Canisterのcycles残高を定期的にチェック
2. **バックアップ**: 週次でstable memoryのバックアップを取得
3. **セキュリティ**: admin principalは必ず変更し、ハードウェアウォレットで管理
4. **パフォーマンス**: 写真アップロードは256KBチャンクに分割
5. **可用性**: cycles自動補充の設定を検討

## サポート

問題が発生した場合：
- GitHub Issues: https://github.com/yourusername/guess-the-spot/issues
- Discord: https://discord.gg/guess-the-spot