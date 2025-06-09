# Guess‑the‑Spot ― 写真方位推理ゲーム on ICP

### バージョン 1.0  (2025‑06‑09)

---

## 目次

1. 概要 (Abstract)
2. 背景と課題
3. ソリューション概要
4. 技術アーキテクチャ
      4.1 システム構成図
      4.2 各 Canister の役割
      4.3 データモデル
5. ゲームメカニクス
      5.1 ゲームフロー（セッション制）
      5.2 スコアリング
      5.3 Reputation & Quality Score
6. トークンエコノミクス
      6.1 SPOT トークン仕様
      6.2 報酬計算式
      6.3 Treasury と Burn/Sink
      6.4 ステーキングとガバナンス
7. Guessデータ活用
      7.1 Quality自動評価
      7.2 ヒートマップ
      7.3 コミュニティ修正
8. セキュリティ & 不正対策
9. ストレージとコスト見積り
10. ガバナンス & DAO ロードマップ
11. 開発ロードマップ
12. リスクと法的考慮
13. 参考文献

---

## 1. 概要 (Abstract)

**Guess‑the‑Spot** は、ユーザーが投稿した実写写真と撮影方位のみを手掛かりに、他プレイヤーが撮影地点を推理する位置情報ゲームである。本プロジェクトは、Internet Computer (ICP) のブロックチェーン上で、写真自体のオンチェーン保存、NFT 化、報酬トークンの自動分配を実現し、改ざん耐性とオープンな収益モデルを両立する。

v1.0では、セッション制の導入、リトライ・ヒント課金によるトークンSink機能、Guessデータの二次活用による価値創出を実現する。

---

## 2. 背景と課題

従来の GeoGuess 系ゲームではコンテンツ著作権やサーバ費用の問題から、中央集権的な運営が必要だった。さらに投稿写真に対する信頼性・報酬分配が不透明であり、投稿インセンティブが弱い。ブロックチェーンを活用することで、次の課題解決を目指す。

* 写真の真正性・改ざん検知
* 投稿量に応じた透明な報酬分配
* ゲームバランスを崩す不正行為の抑止
* 持続可能なトークンエコノミーの構築

---

## 3. ソリューション概要

1. **写真 NFT** — 撮影位置・方位を含むメタデータを ICRC‑7 準拠の NFT として発行。
2. **オンチェーン写真保存** — 256 kB チャンクを stable memory に保持。1 MB 写真 ≒ 0.005 USD/年。
3. **GameEngine** — セッション管理、ハーヴァシン距離からスコアを計算し、報酬トークンを自動ミント。
4. **Reputation Oracle** — 写真毎の Quality Score を更新し、低品質写真の出現頻度を指数的に低減。
5. **SPOT トークン** — ICRC‑1 準拠。Play フィー、リトライ、ヒント購入によるSink機能。
6. **GuessHistory** — 推測データを保存し、ヒートマップ・品質評価・コミュニティ修正に活用。

---

## 4. 技術アーキテクチャ

### 4.1 システム構成図

```
┌────────┐   upload_photo  ┌────────────┐
│  Mobile PWA │──────────────►│  PhotoNFT    │
│ (React / RN)│                  │  Canister    │
└────┬──────┘                  └────┬──────┘
     ▼ create_session                ▼ emit
┌────────┐   settle_round   ┌────────────┐
│  Player │────────────────►│ GameEngine │───► RewardMint
└────────┘                  └────┬──────┘        ▲
                                 │ update_q      │ mint
                                 ▼               │
                    ReputationOracle ◄─────┘     │
                          ▲                      │
                          └── GuessHistory ◄─────┘
```

### 4.2 各 Canister の役割

| Canister             | 主機能                                       |
| -------------------- | ------------------------------------------- |
| **PhotoNFT**         | 写真チャンク保存 / NFT 発行 / meta 更新 (qual)        |
| **GameEngine**       | セッション管理・スコア計算・RewardMint 呼出し             |
| **RewardMint**       | SPOT トークン発行・残高管理・Sink処理 (ICRC‑1)         |
| **ReputationOracle** | Quality Score 更新・soft/hard BAN 判定         |
| **GuessHistory**     | Guess保存・集計・ヒートマップAPI                       |

### 4.3 データモデル（抜粋）

```candid
record PhotoMeta {
  lat  : float64;
  lon  : float64;
  azim : float64;
  ts   : int64;
  ver  : blob;     // SafetyNet証拠
  qual : float64;  // 0-1 動的更新
};

record Guess {
  player : Principal;
  lat    : float64;
  lon    : float64;
  dist   : float64;
  ts     : int64;
};

record GameSession {
  user_id     : Principal;
  rounds      : [RoundState];
  current     : nat;
  score_total : nat;
  retries     : nat;
};
```

---

## 5. ゲームメカニクス

### 5.1 ゲームフロー（セッション制）

```
create_session → stage(10) → [guess → score → (retry?) → next]×n → finalize_session
```

* 1セッション = 5〜10ラウンド（設定可能）
* **Retry**: スコア ≥ 60 かつ 1セッション2回まで; 2 SPOT消費
* **Hint**: 1 SPOT/±50m円ヒント、3 SPOT/高品質ヒント（過去類似地点）

### 5.2 スコアリング

#### 表示用スコア (0–5000)
```
Score_display = max(0, 5000 – α·d^β)  // d=距離[m]
推奨 α=13, β=1.3  (25m ≈ 4700点)
```

#### 報酬用スコア (0–100)
```
Score_norm = ceil( Score_display / 50 )  // 0–100に線形マッピング
```

### 5.3 Reputation & Quality

```
d_median = median({dist})
Q_new = 1 – clamp(d_median / 300, 0, 1)
```

* Q<0.2 → 出題頻度↓, 報酬倍率↓
* Q<0.05 & bad_ratio>0.5 → hard BAN (報酬停止)

---

## 6. トークンエコノミクス

### 6.1 SPOT 仕様

* 勘定標準: **ICRC‑1** (decimals=2)
* 初期供給: 0（完全プレイ・マイニング型）
* ポリシー: RewardMint canister のみ mint 権限
* 年間インフレ上限: DAOが設定

### 6.2 報酬計算式

| イベント         | 数式                                        |
| ------------ | ----------------------------------------- |
| **Player**   | `Y = 0.02 · (Score_norm/100) · B(t)`      |
| **Uploader** | `X = 0.30 · Y`                            |
| **漸減係数**     | `B(t) = 1 / (1 + 0.05·t)` (t=累計1万ラウンド単位) |

追加ボーナス（DAO調整可）:
* セッション1位: +50 SPOT
* Score_norm ≥ 90: +1 SPOT

### 6.3 Treasury & Sink

| Sink機能       | 消費量      |
| ------------ | -------- |
| Retry        | 2 SPOT   |
| Hint（基本）     | 1 SPOT   |
| Hint（高品質）    | 3 SPOT   |
| 提案料         | 10 SPOT  |
| Cosmetic     | 可変       |
| 投稿Boost      | 5 SPOT   |

* プレイ手数料 0.01 SPOT/回 → Treasury
* 閾値超過で自動バーン or 賞金プール転送

### 6.4 ステーキングとガバナンス

* √stake 投票力
* UI特典（ヒント解像度向上など）
* 提案料 10 SPOT (Burn50% / Treasury50%)

---

## 7. Guessデータ活用

### 7.1 Quality自動評価

```
d_median = median({dist})
Q_new = 1 – clamp(d_median / 300, 0, 1)
```

Q<0.2で出題頻度・報酬倍率を下げる。

### 7.2 ヒートマップ

* `GET /api/heatmap?photoId=…` → [{lat, lon, weight}]
* セッション終了後、Guess分布を可視化

### 7.3 コミュニティ修正

* Guess偏差閾値超過時、Fix Request送信
* 承認でアップローダー + 協力者に報酬

---

## 8. セキュリティ & 不正対策

| リスク      | 対策                                                 |
| -------- | -------------------------------------------------- |
| 偽 GPS/方位 | SafetyNet/App Attest 証明を meta.ver に含め、PhotoNFT で検証 |
| マルチアカウント | Internet Identity + デバイス FP で重み付け / Sybil Score    |
| 画像盗用     | perceptual hash + 逆画像検索ワーカーで自動通報                   |
| プライバシー   | lat/lon を ±15 m 丸めて公開、正解判定のみ高精度使用                  |

---

## 9. ストレージ & コスト

| 項目      | 値                                   |
| ------- | ----------------------------------- |
| ICP 費用  | 1 GiB·year ≒ 4 T cycles ≒ **\$5.3** |
| 写真 1 MB | **\$0.0053/年**                      |
| 100 万枚  | **\$5 300/年**                       |

---

## 10. ガバナンス & DAO ロードマップ

1. **フェーズ 0**: コア開発チームが root 権限保持
2. **フェーズ 1**: NNS 投票による Reward パラメータ更新
3. **フェーズ 2**: DAO に treasury 操作権委譲、SPOT ステーキング投票

---

## 11. 開発ロードマップ

| 時期       | 内容                                      |
| -------- | --------------------------------------- |
| Q3 2025  | MVP テストネット公開（セッション制実装）                  |
| Q4 2025  | メインネットローンチ、モバイル PWA 公開                   |
| 2026 H1  | GuessHistory実装、ヒートマップ・コミュニティ修正機能        |
| 2026 H2  | DAO移行、マルチ言語展開、AR ヒント機能                  |

---

## 12. リスクと法的考慮

* 位置情報プライバシー法規 (GDPR, 個人情報保護法)
* 著作権侵害通報と DMCA プロセス
* トークンが暗号資産/ゲームポイントとして扱われるか要確認

---

## 13. 参考文献

1. DFINITY Foundation, *Internet Computer Interface Spec*, 2024.
2. ICRC Working Group, *ICRC‑1/2/3/7 Drafts*, 2025.
3. P. Vincenty, "Direct and Inverse Solutions of Geodesics," *Survey Review*, 1975.

© 2025 Guess‑the‑Spot Core Team