import { useEffect } from 'react'
import { PageContainer, Card } from '../components'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const whitepaperContent = `# Guess‑the‑Spot ― 写真方位推理ゲーム on ICP

### バージョン 0.9  (2025‑06‑03)

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
      5.1 スコアリング
      5.2 Reputation & Quality Score
6. トークンエコノミクス
      6.1 SPOT トークン仕様
      6.2 報酬計算式
      6.3 Treasury と Burn/Sink
7. セキュリティ & 不正対策
8. ストレージとコスト見積り
9. ガバナンス & DAO ロードマップ
10. 開発ロードマップ
11. リスクと法的考慮
12. 参考文献

---

## 1. 概要 (Abstract)

**Guess‑the‑Spot** は、ユーザーが投稿した実写写真と撮影方位のみを手掛かりに、他プレイヤーが撮影地点を推理する位置情報ゲームである。本プロジェクトは、Internet Computer (ICP) のブロックチェーン上で、写真自体のオンチェーン保存、NFT 化、報酬トークンの自動分配を実現し、改ざん耐性とオープンな収益モデルを両立する。

---

## 2. 背景と課題

従来の GeoGuess 系ゲームではコンテンツ著作権やサーバ費用の問題から、中央集権的な運営が必要だった。さらに投稿写真に対する信頼性・報酬分配が不透明であり、投稿インセンティブが弱い。ブロックチェーンを活用することで、次の課題解決を目指す。

* 写真の真正性・改ざん検知
* 投稿量に応じた透明な報酬分配
* ゲームバランスを崩す不正行為の抑止

---

## 3. ソリューション概要

1. **写真 NFT** — 撮影位置・方位を含むメタデータを ICRC‑7 準拠の NFT として発行。
2. **オンチェーン写真保存** — 256 kB チャンクを stable memory に保持。1 MB 写真 ≒ 0.005 USD/年。
3. **GameEngine** — ハーヴァシン距離と方位誤差からスコアを計算し、報酬トークンを自動ミント。
4. **Reputation Oracle** — 写真毎の Quality Score を更新し、低品質写真の出現頻度を指数的に低減。
5. **SPOT トークン** — ICRC‑1 準拠。Play フィーと報酬をスマートコントラクトで完結。

---

## 4. 技術アーキテクチャ

### 4.1 システム構成図

\`\`\`
┌────────┐   upload_photo  ┌────────────┐
│  Mobile PWA │──────────────►│  PhotoNFT    │
│ (React / RN)│                  │  Canister    │
└────┬──────┘                  └────┬──────┘
     ▼ play_round                     ▼ emit
┌────────┐   settle_round   ┌────────────┐
│  Player │────────────────►│ GameEngine │───► RewardMint
└────────┘                  └────┬──────┘        ▲
                                 │ update_q      │ mint
                                 ▼               │
                          ReputationOracle ◄─────┘
\`\`\`

### 4.2 各 Canister の役割

| Canister             | 主機能                                |
| -------------------- | ---------------------------------- |
| **PhotoNFT**         | 写真チャンク保存 / NFT 発行 / meta 更新 (qual) |
| **GameEngine**       | ラウンド生成・スコア計算・RewardMint 呼出し        |
| **RewardMint**       | SPOT トークン発行・残高管理 (ICRC‑1)          |
| **ReputationOracle** | Quality Score 更新・soft/hard BAN 判定  |

### 4.3 データモデル（抜粋）

\`\`\`candid
record PhotoMeta {
  lat  : float64;
  lon  : float64;
  azim : float64;
  ts   : int64;
  ver  : blob;
  qual : float64;
};
\`\`\`

---

## 5. ゲームメカニクス

### 5.1 スコアリング

\`\`\`
S_d = 1 - (d - R_full) / (R_zero - R_full)    (0 ≤ d ≤ R_zero)
S_φ = 1 - φ / θ_max                             (0 ≤ φ ≤ θ_max)
Score = round(S_max · S_d^γ · S_φ^δ)
R_full=25 m, R_zero=1 000 m, θ_max=30°, γ=1.3, δ=0.7, S_max=100
\`\`\`

### 5.2 Reputation & Quality

\`\`\`
F = 1 - 0.7·hit_rate - 0.3·bad_ratio
Q_new = α·Q_old + (1-α)·F        (α=0.8)
\`\`\`

* Q<0.15 & 出題≥30 → soft‑ban (マッチング確率≈0)
* Q<0.05 & bad\_ratio>0.5 → hard BAN (報酬停止)

---

## 6. トークンエコノミクス

### 6.1 SPOT 仕様

* 勘定標準: **ICRC‑1** (decimals=2)
* 初期供給: 0（完全プレイ・マイニング型）
* ポリシー: RewardMint canister のみ mint 権限

### 6.2 報酬計算式

| イベント         | 数式                                  |
| ------------ | ----------------------------------- |
| **Player**   | \`Y = 0.02 · Score/100 · B(t)\`       |
| **Uploader** | \`X = 0.30 · Y\`                      |
| **漸減係数**     | \`B(t) = 1 / (1 + 0.05·t)\` (t=累計出題数) |

### 6.3 Treasury & Sink

* プレイ手数料 0.01 SPOT/回 → Treasury 貯蓄
* DAO 投票⌀バーン⌀開発費に配分

---

## 7. セキュリティ & 不正対策

| リスク      | 対策                                                 |
| -------- | -------------------------------------------------- |
| 偽 GPS/方位 | SafetyNet/App Attest 証明を meta.ver に含め、PhotoNFT で検証 |
| マルチアカウント | Internet Identity + デバイス FP で重み付け / Sybil Score    |
| 画像盗用     | perceptual hash + 逆画像検索ワーカーで自動通報                   |
| プライバシー   | lat/lon を ±15 m 丸めて公開、正解判定のみ高精度使用                  |

---

## 8. ストレージ & コスト

| 項目      | 値                                   |
| ------- | ----------------------------------- |
| ICP 費用  | 1 GiB·year ≒ 4 T cycles ≒ **\\$5.3** |
| 写真 1 MB | **\\$0.0053/年**                      |
| 100 万枚  | **\\$5 300/年**                       |

---

## 9. ガバナンス & DAO ロードマップ

1. **フェーズ 0**: コア開発チームが root 権限保持
2. **フェーズ 1**: NNS 投票による Reward パラメータ更新
3. **フェーズ 2**: DAO に treasury 操作権委譲、SPOT ステーキング投票

---

## 10. 開発ロードマップ

| Q3 2025 | MVP (S‑1〜S‑3) テストネット公開 |
| Q4 2025 | メインネットローンチ、モバイル PWA 公開 |
| 2026 H1 | DAO 移行、マルチ言語展開、AR ヒント機能 |

---

## 11. リスクと法的考慮

* 位置情報プライバシー法規 (GDPR, 個人情報保護法)
* 著作権侵害通報と DMCA プロセス
* トークンが暗号資産/ゲームポイントとして扱われるか要確認

---

## 12. 参考文献

1. DFINITY Foundation, *Internet Computer Interface Spec*, 2024.
2. ICRC Working Group, *ICRC‑1/2/3/7 Drafts*, 2025.
3. P. Vincenty, "Direct and Inverse Solutions of Geodesics," *Survey Review*, 1975.
`

export default function Whitepaper() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <PageContainer title="Whitepaper" subtitle="Guess-the-Spot Technical Documentation">
      <div className="max-w-4xl mx-auto">
        <Card padding="large">
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl font-bold mb-6 text-gray-900">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-800">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl font-semibold mt-6 mb-3 text-gray-700">{children}</h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-lg font-semibold mt-4 mb-2 text-gray-700">{children}</h4>
                ),
                p: ({ children }) => (
                  <p className="mb-4 text-gray-600 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-gray-600">{children}</li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary-500 pl-4 italic my-4">
                    {children}
                  </blockquote>
                ),
                code: ({ children, inline }) => (
                  inline ? (
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  ) : (
                    <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm">
                      {children}
                    </code>
                  )
                ),
                pre: ({ children }) => (
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
                    {children}
                  </pre>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-6">
                    <table className="min-w-full divide-y divide-gray-200">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-gray-50">{children}</thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
                ),
                th: ({ children }) => (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {children}
                  </td>
                ),
                hr: () => (
                  <hr className="my-8 border-gray-200" />
                ),
              }}
            >
              {whitepaperContent}
            </ReactMarkdown>
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}