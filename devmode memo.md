
      73 -  **Dev modeでの正常なログ** (エラーに見えるが正常動作):
      74 -  ```
      75 -  ERROR  🎮 DEV: Certificate error bypassed for method createSession: Invalid certificate: Signature verification failed
      76 -  LOG    🎮 DEV: createSession result: {"ok": "dev-session-1749806602178"}
      77 -  ERROR  🎮 DEV: Certificate error bypassed for method getNextRound: Invalid certificate: Signature verification failed
      78 -  LOG    Get round result: {"ok": {"photoId": 1n, ...}}
      79 -  ```
      80 -  → これらは証明書エラー回避が正しく機能している証拠です！
      81 -  
      73   **解決のポイント**:
      74 - 1. Dev modeでは既存actorを再利用せず、常に新しいactorを作成
      75 - 2. `for...in`ループで確実にすべてのメソッドをラップ
      76 - 3. 証明書エラー時はモックレスポンスを返してゲームを継続
      74 + 1. MockCertificateクラスで必要なメソッドをすべて実装
      75 + 2. lookupメソッドが'in'演算子で使用可能なオブジェクトを返す
      76 + 3. HttpAgentのquery/callメソッドでも証明書エラーをキャッチ
      77 +  4. Dev modeでも実際のトランザクションが送信される
      78 
      79 -  ### Dev Modeトランザクション問題の最終解決 (2025-06-13) ✅
      80 -  
      81 -  **問題**: 証明書エラー回避でモックレスポンスを返していたため、実際のトランザクションが送信されず、トークン残高が更新されない
      82 -  
      83 -  **最終的な解決方法**:
      84 -  1. **earlyPatches.tsで@dfinity/agentをパッチ**
      85 -     ```typescript
      86 -     // Certificate.createをオーバーライドして証明書検証を無効化
      87 -     agentModule.Certificate.create = function(options: any) {
      88 -       // 常に検証済みの証明書を返す
      89 -       return { verified: true, ... };
      90 -     };
      91 -     ```
      92 -  
      93 -  2. **game.tsを簡略化**
      94 -     - Actorメソッドのラップを削除
      95 -     - HttpAgentのcallメソッドのオーバーライドを削除
      96 -     - Dev modeでも通常のActor作成を実行
      97 -  
      98 -  **結果**:
      99 -  - 証明書エラーが発生しない
     100 -  - 実際のトランザクションがバックエンドに送信される
     101 -  - トークン残高が正しく更新される
     102 -  - ゲーム統計が正しく記録される
     103 -  
     104 -  **重要**: earlyPatches.tsがApp.tsxで最初にインポートされていることが必須
     105 -  