# Guess-the-Spot アーキテクチャ設計書

## 🔄 最新の作業状況 (2025-06-06)

### メモ
- このアプリは速やかに本番環境で使用されます
- デモデータを入れないこと

### 本日の完了事項
1. **ICPメインネットへのデプロイ完了** ✅
   - Backend (unified): `77fv5-oiaaa-aaaal-qsoea-cai`
   - Frontend: `7yetj-dqaaa-aaaal-qsoeq-cai`
   - https://7yetj-dqaaa-aaaal-qsoeq-cai.icp0.io/

2. **バックエンドの修正** ✅
   - Trie API の互換性問題を修正（dfx v0.27.0対応）
   - photo.mo の`type`フィールドを`notificationType`に変更（予約語回避）
   - 既存canisterへの再インストール（データリセット）

3. **フロントエンドの修正** ✅
   - photoService.tsのIDL定義を修正（PhotoUploadRequest形式）
   - エラー「Record is missing key "latitude"」を解決
   - 環境変数設定（.env）でメインネットcanister IDを設定

### 前回の状態（2025-06-05）
- **フロントエンド**: ViteからExpoに移行完了
- **Metro Bundler問題**: 一時的な回避策あり
- **本番環境への注意**: これは実際に本番環境で提供するサービスです

### 完了したタスク
1. ✅ Vite版フロントエンドからExpo/React Nativeへの完全移行
2. ✅ 全画面の実装：
   - LoginScreen（認証）
   - HomeScreen（ホーム）
   - CameraScreen（カメラ・位置情報）
   - GameScreen（ゲーム選択）
   - GamePlayScreen（ゲームプレイ - 600行以上の包括的実装）
   - GameResultScreen（結果表示）
   - LeaderboardScreen（リーダーボード）
   - ProfileScreen（プロフィール）
3. ✅ ナビゲーション設定（React Navigation）
4. ✅ 状態管理（Zustand）
5. ✅ ICP統合用のpolyfills準備

### 重要な開発方針
- **開発ツール**: Motoko Playground（ブラウザ版）を使用しない
- デモデータは絶対に入れないこと

（以下、既存のドキュメントの残りの部分は省略）