# 予約投稿システム設計書

## 概要
Guess the Spotにおける予約投稿機能により、ユーザーは写真を撮影後、すぐに公開するか、指定した時間に公開するかを選択できます。

## 設計目標
1. **ユーザー体験の向上**: 撮影時と公開時を分離し、戦略的な投稿を可能に
2. **ゲームバランスの改善**: 時間帯による有利不利を調整
3. **エンゲージメント向上**: 定期的なコンテンツ公開によるユーザー維持

## アーキテクチャ

### 1. データ構造の拡張

```motoko
// types/photo.mo に追加
public type ScheduledPhoto = {
    id: Nat;
    photoMeta: PhotoMeta;
    imageChunks: [PhotoChunk];
    scheduledPublishTime: Time.Time;
    status: {
        #pending;
        #published;
        #cancelled;
    };
    createdAt: Time.Time;
    updatedAt: Time.Time;
};

public type PhotoUploadRequest = {
    meta: PhotoMeta;
    totalChunks: Nat;
    scheduledPublishTime: ?Time.Time; // null = 即時公開
    title: Text;
    description: Text;
    difficulty: { #EASY; #NORMAL; #HARD; #EXTREME };
    hint: Text;
    tags: [Text];
};
```

### 2. Canister機能の実装

#### backend/unified/main.mo に追加

```motoko
// 予約投稿の保存
private stable var scheduledPhotos : Trie.Trie<Nat, ScheduledPhoto> = Trie.empty();
private stable var nextScheduledPhotoId : Nat = 0;

// タイマーID管理
private stable var publishTimers : Trie.Trie<Nat, Timer.TimerId> = Trie.empty();

// 予約投稿の作成
public shared(msg) func schedulePhotoUpload(request: PhotoUploadRequest) : async Result.Result<Nat, Text> {
    let caller = msg.caller;
    
    // 認証チェック
    if (Principal.isAnonymous(caller)) {
        return #err("Anonymous users cannot upload photos");
    };
    
    // 予約時間の検証
    switch (request.scheduledPublishTime) {
        case (?scheduledTime) {
            let now = Time.now();
            if (scheduledTime <= now) {
                return #err("Scheduled time must be in the future");
            };
            
            // 最大予約期間のチェック（30日）
            let maxScheduleTime = now + (30 * 24 * 60 * 60 * 1_000_000_000);
            if (scheduledTime > maxScheduleTime) {
                return #err("Cannot schedule more than 30 days in advance");
            };
        };
        case null { /* 即時公開 */ };
    };
    
    // 写真IDの生成
    let photoId = nextScheduledPhotoId;
    nextScheduledPhotoId += 1;
    
    // 予約投稿の作成
    let scheduledPhoto : ScheduledPhoto = {
        id = photoId;
        photoMeta = request.meta;
        imageChunks = [];
        scheduledPublishTime = Option.get(request.scheduledPublishTime, Time.now());
        status = #pending;
        createdAt = Time.now();
        updatedAt = Time.now();
    };
    
    // 保存
    scheduledPhotos := Trie.put(
        scheduledPhotos,
        key(photoId),
        Nat.equal,
        scheduledPhoto
    );
    
    // タイマーの設定
    switch (request.scheduledPublishTime) {
        case (?scheduledTime) {
            let delay = Int.abs(scheduledTime - Time.now());
            let timerId = Timer.setTimer(
                #nanoseconds(delay),
                func() : async () {
                    await publishScheduledPhoto(photoId);
                }
            );
            publishTimers := Trie.put(
                publishTimers,
                key(photoId),
                Nat.equal,
                timerId
            );
        };
        case null {
            // 即時公開
            ignore await publishScheduledPhoto(photoId);
        };
    };
    
    #ok(photoId);
};

// 予約投稿の公開処理
private func publishScheduledPhoto(photoId: Nat) : async () {
    switch (Trie.get(scheduledPhotos, key(photoId), Nat.equal)) {
        case (?scheduled) {
            if (scheduled.status == #pending) {
                // NFTとしてミント
                let nftId = await mintPhotoNFT(scheduled.photoMeta);
                
                // ステータス更新
                let updated = {
                    scheduled with
                    status = #published;
                    updatedAt = Time.now();
                };
                
                scheduledPhotos := Trie.put(
                    scheduledPhotos,
                    key(photoId),
                    Nat.equal,
                    updated
                );
                
                // ゲームラウンドに追加
                ignore await createGameRound(nftId);
                
                // タイマーのクリーンアップ
                publishTimers := Trie.remove(publishTimers, key(photoId), Nat.equal);
            };
        };
        case null {};
    };
};

// 予約投稿のキャンセル
public shared(msg) func cancelScheduledPhoto(photoId: Nat) : async Result.Result<(), Text> {
    let caller = msg.caller;
    
    switch (Trie.get(scheduledPhotos, key(photoId), Nat.equal)) {
        case (?scheduled) {
            // 所有者チェック
            if (scheduled.photoMeta.owner != caller) {
                return #err("Not the owner");
            };
            
            if (scheduled.status != #pending) {
                return #err("Photo already published or cancelled");
            };
            
            // タイマーのキャンセル
            switch (Trie.get(publishTimers, key(photoId), Nat.equal)) {
                case (?timerId) {
                    Timer.cancelTimer(timerId);
                    publishTimers := Trie.remove(publishTimers, key(photoId), Nat.equal);
                };
                case null {};
            };
            
            // ステータス更新
            let updated = {
                scheduled with
                status = #cancelled;
                updatedAt = Time.now();
            };
            
            scheduledPhotos := Trie.put(
                scheduledPhotos,
                key(photoId),
                Nat.equal,
                updated
            );
            
            #ok(());
        };
        case null {
            #err("Scheduled photo not found");
        };
    };
};

// ユーザーの予約投稿一覧取得
public query(msg) func getUserScheduledPhotos() : async [ScheduledPhoto] {
    let caller = msg.caller;
    
    Trie.toArray(
        scheduledPhotos,
        func (k: Nat, v: ScheduledPhoto) : ?ScheduledPhoto {
            if (v.photoMeta.owner == caller and v.status == #pending) {
                ?v
            } else {
                null
            }
        }
    );
};
```

### 3. フロントエンドの実装

#### 予約投稿管理画面の追加

```typescript
// src/frontend/src/screens/ScheduledPhotosScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import photoService from '../services/photo';

export default function ScheduledPhotosScreen() {
  const [scheduledPhotos, setScheduledPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadScheduledPhotos();
  }, []);

  const loadScheduledPhotos = async () => {
    try {
      const photos = await photoService.getUserScheduledPhotos();
      setScheduledPhotos(photos.sort((a, b) => 
        a.scheduledPublishTime - b.scheduledPublishTime
      ));
    } catch (error) {
      console.error('Failed to load scheduled photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelScheduledPhoto = async (photoId: bigint) => {
    Alert.alert(
      '確認',
      'この予約投稿をキャンセルしますか？',
      [
        { text: 'いいえ', style: 'cancel' },
        {
          text: 'はい',
          style: 'destructive',
          onPress: async () => {
            try {
              await photoService.cancelScheduledPhoto(photoId);
              await loadScheduledPhotos();
              Alert.alert('成功', '予約投稿をキャンセルしました');
            } catch (error) {
              Alert.alert('エラー', 'キャンセルに失敗しました');
            }
          },
        },
      ]
    );
  };

  const renderScheduledPhoto = ({ item }) => {
    const publishTime = new Date(Number(item.scheduledPublishTime / 1000000n));
    const now = new Date();
    const timeRemaining = publishTime - now;
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

    return (
      <View style={styles.photoCard}>
        <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />
        <View style={styles.photoInfo}>
          <Text style={styles.photoTitle}>{item.title}</Text>
          <Text style={styles.publishTime}>
            公開予定: {publishTime.toLocaleString('ja-JP')}
          </Text>
          <Text style={styles.timeRemaining}>
            残り: {hoursRemaining}時間{minutesRemaining}分
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => cancelScheduledPhoto(item.id)}
        >
          <Text style={styles.cancelButtonText}>キャンセル</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={scheduledPhotos}
        renderItem={renderScheduledPhoto}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            予約投稿はありません
          </Text>
        }
      />
    </View>
  );
}
```

### 4. セキュリティと制限

1. **投稿数制限**
   - 1ユーザーあたり最大10件の予約投稿
   - 24時間あたり最大5件の新規予約

2. **時間制限**
   - 最短: 5分後
   - 最長: 30日後

3. **キャンセル制限**
   - 公開5分前までキャンセル可能

### 5. 通知システム

```motoko
// 予約投稿の通知
public type Notification = {
    id: Nat;
    userId: Principal;
    type: { 
        #scheduledPhotoPublished;
        #scheduledPhotoFailed;
        #scheduledPhotoReminder;
    };
    photoId: Nat;
    message: Text;
    timestamp: Time.Time;
    read: Bool;
};
```

### 6. 統計とアナリティクス

```motoko
// 予約投稿の統計情報
public type SchedulingStats = {
    totalScheduled: Nat;
    avgScheduleDelay: Nat; // 分単位
    popularScheduleTimes: [(Nat, Nat)]; // (時間, 件数)
    cancellationRate: Float;
};
```

## メリット

1. **ユーザーメリット**
   - 最適な時間帯に投稿可能
   - 旅行中の写真をまとめて予約
   - 戦略的なゲーム参加

2. **システムメリット**
   - コンテンツの安定供給
   - サーバー負荷の分散
   - エンゲージメントの向上

3. **ゲームメリット**
   - 24時間均等なコンテンツ
   - グローバルプレイヤーへの配慮
   - 難易度の時間的分散

## 今後の拡張

1. **AIによる最適時間提案**
2. **予約投稿のグループ化**
3. **定期投稿機能**
4. **投稿前の自動品質チェック**