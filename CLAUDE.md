# Guess-the-Spot アーキテクチャ設計書

## 🔄 最新の作業状況 (2025-06-09 深夜) ✅ リファクタリング完了

### 本日の完了事項（バックエンドのモジュール化）
1. **大規模リファクタリング成功** ✅
   - 1198行の`unified/main.mo`を8つのモジュールに分割
   - 各モジュールが単一責任原則に従う設計
   - 全てのコンパイルエラーを修正

2. **作成したモジュール** ✅
   - **Constants.mo**: システム定数の集約
   - **Helpers.mo**: ユーティリティ関数
   - **TokenModule.mo**: ICRC-1トークン実装
   - **TreasuryModule.mo**: Treasury/シンク管理
   - **GameEngineModule.mo**: ゲームセッション管理
   - **GuessHistoryModule.mo**: 推測履歴/ヒートマップ
   - **PhotoModule.mo**: 写真管理システム
   - **ReputationModule.mo**: ユーザー評価システム

3. **統合テスト結果** ✅
   - 12テスト中11テストが成功
   - トークン機能: ✅ 全て成功
   - ゲームセッション: ✅ 成功
   - レピュテーション: ✅ 成功
   - Treasury管理: ✅ 成功
   - システム統計: ✅ 成功
   - リーダーボード: ✅ 成功
   - 写真アップロード: ❌ パラメータ形式の問題

4. **コードの改善点**
   - 保守性の大幅向上
   - テスタビリティの改善
   - アップグレード時の安全性確保
   - 型安全性の強化

### モジュール構造
```
src/backend/unified/
├── main.mo (メインアクター - 各モジュールを統合)
└── modules/
    ├── Constants.mo
    ├── Helpers.mo
    ├── TokenModule.mo
    ├── TreasuryModule.mo
    ├── GameEngineModule.mo
    ├── GuessHistoryModule.mo
    ├── PhotoModule.mo
    └── ReputationModule.mo
```

## 🔄 最新の作業状況 (2025-06-09 夜) 

### app.jsonエラー修正 ✅
#### 修正内容
- **ファイル**: `src/frontend/app.json`
- **問題**: JSONファイル内にJavaScript関数 `(type: string) => type` を記述していた
- **原因**: JSONファイルではJavaScript構文（関数、コメント等）は使用不可
- **解決**: parseオブジェクトを含むconfig部分を削除し、シンプルなlinking設定に変更

```json
// 修正前（エラー）
"linking": {
  "prefixes": ["guessthespot://", "https://guess-the-spot.app"],
  "config": {
    "screens": {
      "auth": {
        "path": "/auth/:type",
        "parse": {
          "type": (type: string) => type  // ❌ JSONで関数は使用不可
        }
      }
    }
  }
}

// 修正後（正常）
"linking": {
  "prefixes": ["guessthespot://", "https://guess-the-spot.app"]
}
```

### expo-ii-integration実装 ✅
- 公式expo-ii-integrationライブラリの完全統合
- 必要な依存関係のインストール完了
- II統合用の各種ファイル作成完了

## 🔄 作業ログ

### 作業記録
- 作業ファイル: `CLAUDE.md`に作業内容を追記

### 2025-06-09 夜 - バックエンドリファクタリング計画

#### 目的
- 1198行の巨大なunified/main.moを機能別モジュールに分割
- コードの可読性と保守性の向上
- テストが全てパスすることを確認

#### リファクタリング計画
1. **モジュール分割**:
   - `modules/Constants.mo` - 定数定義
   - `modules/TokenModule.mo` - ICRC-1トークン実装
   - `modules/GameEngineModule.mo` - ゲームセッション管理
   - `modules/GuessHistoryModule.mo` - 推測履歴
   - `modules/TreasuryModule.mo` - Treasury管理
   - `modules/PhotoModule.mo` - 写真NFT
   - `modules/ReputationModule.mo` - レピュテーション
   - `modules/Helpers.mo` - 共通ヘルパー関数

2. **原則**:
   - 各モジュールは単一責任の原則に従う
   - 相互依存を最小限に抑える
   - 公開APIは変更しない（後方互換性維持）
   - テストが全てパスすることを確認

#### 進捗
- [x] モジュールディレクトリ作成
- [ ] 定数の分離
- [ ] トークンモジュールの分離
- [ ] ゲームエンジンモジュールの分離
- [ ] 推測履歴モジュールの分離
- [ ] Treasuryモジュールの分離
- [ ] 写真モジュールの分離
- [ ] レピュテーションモジュールの分離
- [ ] main.moの再構成
- [ ] テスト実行と修正