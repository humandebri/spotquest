# Motoko Playground (ブラウザ版) デプロイ手順

## 最も簡単で無料の方法

### 1. Motoko Playgroundを開く
https://play.motoko.org/

### 2. 新しいプロジェクトを作成
- 「+ New Motoko project」をクリック
- プロジェクト名: "guess-the-spot"

### 3. コードをコピー
以下のファイルの内容をPlaygroundにコピー：
- `src/backend/unified/main.mo`

### 4. デプロイ
- 右上の「Deploy」ボタンをクリック
- 数秒待つと、Canister IDが表示されます

### 5. Canister IDを保存
デプロイ後、表示されたCanister IDをメモしてください。
例: `xxxxx-xxxxx-xxxxx-xxxxx-cai`

### 6. フロントエンド設定
```bash
# src/frontend/.env を作成
echo "EXPO_PUBLIC_UNIFIED_CANISTER_ID=<あなたのCanister ID>" > src/frontend/.env
echo "EXPO_PUBLIC_IC_HOST=https://icp0.io" >> src/frontend/.env
```

### 7. フロントエンドを起動
```bash
cd src/frontend
npm start
```

## 注意事項
- Motoko Playgroundのcanisterは一定期間後に削除される可能性があります
- テスト用途には最適ですが、本番環境には適していません
- 永続的なデプロイには、実際のICメインネットを使用してください

## トラブルシューティング
- コードが大きすぎる場合は、不要な関数を削除してください
- エラーが発生した場合は、Motokoの構文エラーをチェックしてください