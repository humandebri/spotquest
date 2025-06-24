import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface AggregatedRatings {
  'interest' : { 'total' : bigint, 'count' : bigint, 'average' : number },
  'difficulty' : { 'total' : bigint, 'count' : bigint, 'average' : number },
  'lastUpdated' : Time,
  'beauty' : { 'total' : bigint, 'count' : bigint, 'average' : number },
  'photoId' : bigint,
}
export type ChunkUploadState = { 'Failed' : null } |
  { 'Complete' : null } |
  { 'Incomplete' : null };
export type CountryCode = string;
export interface CreatePhotoRequest {
  'region' : RegionCode,
  'latitude' : number,
  'title' : string,
  'country' : CountryCode,
  'hint' : string,
  'azimuth' : [] | [number],
  'difficulty' : { 'EASY' : null } |
    { 'HARD' : null } |
    { 'NORMAL' : null } |
    { 'EXTREME' : null },
  'tags' : Array<string>,
  'description' : string,
  'totalSize' : bigint,
  'longitude' : number,
  'sceneKind' : SceneKind,
  'expectedChunks' : bigint,
}
export interface GameSession {
  'id' : SessionId,
  'startTime' : Time,
  'endTime' : [] | [Time],
  'currentRound' : bigint,
  'userId' : Principal,
  'lastActivity' : Time,
  'totalScore' : bigint,
  'retryCount' : bigint,
  'totalScoreNorm' : bigint,
  'rounds' : Array<RoundState>,
}
export type GeoHash = string;
export interface Guess {
  'lat' : number,
  'lon' : number,
  'player' : Principal,
  'dist' : number,
  'timestamp' : Time,
  'sessionId' : string,
  'photoId' : bigint,
}
export interface GuessData {
  'lat' : number,
  'lon' : number,
  'azimuth' : [] | [number],
  'confidenceRadius' : number,
  'submittedAt' : Time,
}
export interface Heatmap {
  'gridSize' : bigint,
  'bounds' : {
    'minLat' : number,
    'minLon' : number,
    'maxLat' : number,
    'maxLon' : number,
  },
  'heatmap' : Array<Array<number>>,
  'totalGuesses' : bigint,
  'photoId' : bigint,
}
export type HintInfo = { 'RadiusHint' : bigint } |
  { 'DirectionHint' : string };
export type HintType = { 'PremiumRadius' : null } |
  { 'DirectionHint' : null } |
  { 'BasicRadius' : null };
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
}
export interface HttpResponse {
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
  'status_code' : number,
}
export interface OverallPhotoStats {
  'photosByRegion' : Array<[RegionCode, bigint]>,
  'photosBySceneKind' : Array<[SceneKind, bigint]>,
  'activePhotos' : bigint,
  'popularTags' : Array<[string, bigint]>,
  'totalSize' : bigint,
  'totalPhotos' : bigint,
  'photosByCountry' : Array<[CountryCode, bigint]>,
}
export interface PhotoMetaV2 {
  'id' : bigint,
  'region' : RegionCode,
  'status' : { 'Active' : null } |
    { 'Banned' : null } |
    { 'Deleted' : null },
  'latitude' : number,
  'aggregatedRatings' : [] | [
    {
      'interest' : { 'total' : bigint, 'count' : bigint, 'average' : number },
      'difficulty' : { 'total' : bigint, 'count' : bigint, 'average' : number },
      'lastUpdated' : Time,
      'beauty' : { 'total' : bigint, 'count' : bigint, 'average' : number },
    }
  ],
  'title' : string,
  'country' : CountryCode,
  'geoHash' : GeoHash,
  'owner' : Principal,
  'hint' : string,
  'azimuth' : [] | [number],
  'difficulty' : { 'EASY' : null } |
    { 'HARD' : null } |
    { 'NORMAL' : null } |
    { 'EXTREME' : null },
  'tags' : Array<string>,
  'description' : string,
  'lastUsedTime' : [] | [Time],
  'totalSize' : bigint,
  'qualityScore' : number,
  'timesUsed' : bigint,
  'longitude' : number,
  'sceneKind' : SceneKind,
  'uploadState' : ChunkUploadState,
  'chunkCount' : bigint,
  'uploadTime' : Time,
}
export interface PhotoStats {
  'playCount' : bigint,
  'bestScore' : bigint,
  'worstScore' : bigint,
  'totalScore' : bigint,
  'averageScore' : number,
}
export interface RatingDistribution {
  'totalRatings' : bigint,
  'interest' : Array<bigint>,
  'difficulty' : Array<bigint>,
  'beauty' : Array<bigint>,
}
export type RegionCode = string;
export interface Reputation {
  'uploads' : bigint,
  'user' : Principal,
  'lastUpdated' : Time,
  'score' : number,
  'validations' : bigint,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : string } |
  { 'err' : string };
export type Result_10 = { 'ok' : RoundState } |
  { 'err' : string };
export type Result_11 = { 'ok' : Heatmap } |
  { 'err' : string };
export type Result_12 = { 'ok' : SessionResult } |
  { 'err' : string };
export type Result_13 = { 'ok' : SessionId } |
  { 'err' : string };
export type Result_14 = { 'ok' : bigint } |
  { 'err' : string };
export type Result_15 = {
    'ok' : { 'clearedChunks' : bigint, 'clearedPhotos' : bigint }
  } |
  { 'err' : string };
export type Result_2 = { 'ok' : RoundResult } |
  { 'err' : string };
export type Result_3 = { 'ok' : HintInfo } |
  { 'err' : string };
export type Result_4 = {
    'ok' : {
      'chunksCount' : bigint,
      'errors' : Array<string>,
      'photosCount' : bigint,
    }
  } |
  { 'err' : string };
export type Result_5 = { 'ok' : bigint } |
  { 'err' : TransferError };
export type Result_6 = { 'ok' : Array<SessionInfo> } |
  { 'err' : string };
export type Result_7 = { 'ok' : GameSession } |
  { 'err' : string };
export type Result_8 = { 'ok' : Array<SessionSummary> } |
  { 'err' : string };
export type Result_9 = {
    'ok' : {
      'stableChunks' : bigint,
      'stablePhotos' : bigint,
      'legacyChunks' : bigint,
      'legacyPhotos' : bigint,
    }
  } |
  { 'err' : string };
export interface RoundResult {
  'actualLocation' : { 'lat' : number, 'lon' : number },
  'distance' : number,
  'displayScore' : bigint,
  'normalizedScore' : bigint,
  'guessLocation' : { 'lat' : number, 'lon' : number },
  'photoId' : bigint,
}
export interface RoundState {
  'hintsPurchased' : Array<HintType>,
  'startTime' : Time,
  'status' : RoundStatus,
  'endTime' : [] | [Time],
  'retryAvailable' : boolean,
  'score' : bigint,
  'guessData' : [] | [GuessData],
  'scoreNorm' : bigint,
  'photoId' : bigint,
}
export type RoundStatus = { 'Active' : null } |
  { 'Retried' : null } |
  { 'TimedOut' : null } |
  { 'Completed' : null };
export type SceneKind = { 'Store' : null } |
  { 'Building' : null } |
  { 'Nature' : null } |
  { 'Facility' : null } |
  { 'Other' : null };
export interface SearchFilter {
  'region' : [] | [RegionCode],
  'status' : [] | [
    { 'Active' : null } |
      { 'Banned' : null } |
      { 'Deleted' : null }
  ],
  'country' : [] | [CountryCode],
  'owner' : [] | [Principal],
  'difficulty' : [] | [
    { 'EASY' : null } |
      { 'HARD' : null } |
      { 'NORMAL' : null } |
      { 'EXTREME' : null }
  ],
  'tags' : [] | [Array<string>],
  'sceneKind' : [] | [SceneKind],
  'nearLocation' : [] | [
    { 'latitude' : number, 'longitude' : number, 'radiusKm' : number }
  ],
}
export interface SearchResult {
  'hasMore' : boolean,
  'cursor' : [] | [bigint],
  'totalCount' : bigint,
  'photos' : Array<PhotoMetaV2>,
}
export type SessionId = string;
export interface SessionInfo {
  'id' : SessionId,
  'status' : SessionStatus,
  'currentRound' : [] | [bigint],
  'createdAt' : Time,
  'players' : Array<Principal>,
  'roundCount' : bigint,
}
export interface SessionResult {
  'playerReward' : bigint,
  'duration' : bigint,
  'completedRounds' : bigint,
  'userId' : Principal,
  'rank' : [] | [bigint],
  'uploaderRewards' : Array<[Principal, bigint]>,
  'totalScore' : bigint,
  'totalRounds' : bigint,
  'totalScoreNorm' : bigint,
  'sessionId' : SessionId,
}
export type SessionStatus = { 'Abandoned' : null } |
  { 'Active' : null } |
  { 'Completed' : null };
export interface SessionSummary {
  'id' : SessionId,
  'status' : SessionStatus,
  'duration' : [] | [bigint],
  'currentRound' : [] | [bigint],
  'createdAt' : Time,
  'totalScore' : bigint,
  'roundCount' : bigint,
}
export type Time = bigint;
export interface TransferArgs {
  'to' : Account,
  'fee' : [] | [bigint],
  'memo' : [] | [Uint8Array | number[]],
  'from_subaccount' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [Time],
  'amount' : bigint,
}
export type TransferError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'BadBurn' : { 'min_burn_amount' : bigint } } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface _SERVICE {
  'adminBanPhoto' : ActorMethod<[bigint], Result>,
  'adminBanUser' : ActorMethod<[Principal], Result>,
  'adminMint' : ActorMethod<[Principal, bigint], Result_14>,
  'adminUnbanUser' : ActorMethod<[Principal], Result>,
  'canRatePhoto' : ActorMethod<[string, bigint], boolean>,
  'clearLegacyPhotoData' : ActorMethod<[], Result_15>,
  'createPhotoV2' : ActorMethod<[CreatePhotoRequest], Result_14>,
  'createSession' : ActorMethod<[], Result_13>,
  'debugCalculatePlayerReward' : ActorMethod<
    [string],
    {
      'roundDetails' : Array<[bigint, bigint]>,
      'totalScore' : bigint,
      'sessionFound' : boolean,
      'totalReward' : bigint,
      'roundCount' : bigint,
    }
  >,
  'debugGetPlayerSessions' : ActorMethod<
    [Principal],
    {
      'totalCompleted' : bigint,
      'sessionIds' : Array<string>,
      'sessions' : Array<
        {
          'id' : string,
          'currentRound' : bigint,
          'totalScore' : bigint,
          'hasEndTime' : boolean,
          'rounds' : bigint,
        }
      >,
    }
  >,
  'debugPhotoMigrationStatus' : ActorMethod<
    [],
    {
      'stableChunks' : bigint,
      'stablePhotos' : bigint,
      'legacyChunks' : bigint,
      'legacyPhotos' : bigint,
    }
  >,
  'debugPhotoStorage' : ActorMethod<
    [],
    {
      'stablePhotosCount' : bigint,
      'storageSize' : bigint,
      'firstPhotoIds' : Array<bigint>,
      'stableChunksCount' : bigint,
      'totalPhotos' : bigint,
      'nextPhotoId' : bigint,
    }
  >,
  'deletePhotoV2' : ActorMethod<[bigint], Result>,
  'finalizePhotoUploadV2' : ActorMethod<[bigint], Result>,
  'finalizeSession' : ActorMethod<[string], Result_12>,
  'generateHeatmap' : ActorMethod<[bigint], Result_11>,
  'getLeaderboard' : ActorMethod<[bigint], Array<[Principal, bigint]>>,
  'getLeaderboardWithStats' : ActorMethod<
    [bigint],
    Array<
      [
        Principal,
        {
          'photosUploaded' : bigint,
          'username' : [] | [string],
          'gamesPlayed' : bigint,
          'totalRewards' : bigint,
          'score' : bigint,
        },
      ]
    >
  >,
  'getMultiplePhotoRatings' : ActorMethod<
    [Array<bigint>],
    Array<[bigint, [] | [AggregatedRatings]]>
  >,
  'getNextRound' : ActorMethod<[string, [] | [string]], Result_10>,
  'getOwner' : ActorMethod<[], Principal>,
  'getPhotoChunkV2' : ActorMethod<
    [bigint, bigint],
    [] | [Uint8Array | number[]]
  >,
  'getPhotoCompleteDataV2' : ActorMethod<
    [bigint],
    [] | [Uint8Array | number[]]
  >,
  'getPhotoGuesses' : ActorMethod<[bigint, [] | [bigint]], Array<Guess>>,
  'getPhotoMetadataV2' : ActorMethod<[bigint], [] | [PhotoMetaV2]>,
  'getPhotoMigrationStatus' : ActorMethod<[], Result_9>,
  'getPhotoRatings' : ActorMethod<[bigint], [] | [AggregatedRatings]>,
  'getPhotoStatsDetailsV2' : ActorMethod<[bigint], [] | [PhotoStats]>,
  'getPhotoStatsV2' : ActorMethod<[], OverallPhotoStats>,
  'getPlayerHistory' : ActorMethod<[Principal, [] | [bigint]], Array<bigint>>,
  'getPlayerRank' : ActorMethod<[Principal], [] | [bigint]>,
  'getPlayerStats' : ActorMethod<
    [Principal],
    {
      'rank' : [] | [bigint],
      'totalGamesPlayed' : bigint,
      'averageDuration' : bigint,
      'reputation' : number,
      'bestScore' : bigint,
      'suspiciousActivityFlags' : [] | [string],
      'totalGuesses' : bigint,
      'totalPhotosUploaded' : bigint,
      'totalRewardsEarned' : bigint,
      'longestStreak' : bigint,
      'averageScore30Days' : [] | [bigint],
      'winRate' : number,
      'averageScore' : bigint,
      'currentStreak' : bigint,
    }
  >,
  'getRatingDistribution' : ActorMethod<[bigint], [] | [RatingDistribution]>,
  'getRatingStats' : ActorMethod<
    [],
    {
      'totalRatings' : bigint,
      'totalRatingUsers' : bigint,
      'totalRatedPhotos' : bigint,
    }
  >,
  'getRecentSessionsWithScores' : ActorMethod<[Principal, bigint], Result_8>,
  'getReputation' : ActorMethod<[Principal], Reputation>,
  'getReputationLeaderboard' : ActorMethod<
    [bigint],
    Array<[Principal, number]>
  >,
  'getSession' : ActorMethod<[string], Result_7>,
  'getSinkHistory' : ActorMethod<
    [[] | [bigint]],
    Array<[Time, string, bigint]>
  >,
  'getSystemStats' : ActorMethod<
    [],
    {
      'gameMetrics' : {
        'totalRounds' : bigint,
        'errorCount' : bigint,
        'totalSessions' : bigint,
        'totalRequests' : bigint,
      },
      'totalSupply' : bigint,
      'totalGuesses' : bigint,
      'totalUsers' : bigint,
      'totalPhotos' : bigint,
      'totalSessions' : bigint,
      'photoStats' : {
        'bannedPhotos' : bigint,
        'activePhotos' : bigint,
        'totalPhotos' : bigint,
        'deletedPhotos' : bigint,
      },
    }
  >,
  'getTopPhotosByUsage' : ActorMethod<
    [bigint],
    Array<
      [
        bigint,
        {
          'title' : string,
          'owner' : Principal,
          'timesUsed' : bigint,
          'photoId' : bigint,
        },
      ]
    >
  >,
  'getTopUploaders' : ActorMethod<
    [bigint],
    Array<
      [
        Principal,
        {
          'username' : [] | [string],
          'totalTimesUsed' : bigint,
          'totalPhotos' : bigint,
        },
      ]
    >
  >,
  'getTreasuryStats' : ActorMethod<
    [],
    { 'balance' : bigint, 'totalSunk' : bigint, 'totalBurned' : bigint }
  >,
  'getUserPhotosV2' : ActorMethod<[[] | [bigint], bigint], SearchResult>,
  'getUserRatingHistory' : ActorMethod<[[] | [bigint]], Array<bigint>>,
  'getUserRatingStats' : ActorMethod<
    [],
    {
      'totalRatings' : bigint,
      'averageBeauty' : number,
      'averageInterest' : number,
      'averageDifficulty' : number,
    }
  >,
  'getUserRatingStatus' : ActorMethod<
    [string, Array<bigint>],
    Array<[bigint, boolean]>
  >,
  'getUserSessions' : ActorMethod<[Principal], Result_6>,
  'getUsername' : ActorMethod<[Principal], [] | [string]>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'http_request_update' : ActorMethod<[HttpRequest], HttpResponse>,
  'icrc1_balance_of' : ActorMethod<[Account], bigint>,
  'icrc1_decimals' : ActorMethod<[], number>,
  'icrc1_fee' : ActorMethod<[], bigint>,
  'icrc1_name' : ActorMethod<[], string>,
  'icrc1_symbol' : ActorMethod<[], string>,
  'icrc1_total_supply' : ActorMethod<[], bigint>,
  'icrc1_transfer' : ActorMethod<[TransferArgs], Result_5>,
  'init' : ActorMethod<[], Result>,
  'migrateLegacyPhotoData' : ActorMethod<[], Result_4>,
  'purchaseHint' : ActorMethod<[string, HintType], Result_3>,
  'searchPhotosV2' : ActorMethod<
    [SearchFilter, [] | [bigint], bigint],
    SearchResult
  >,
  'setPlayFee' : ActorMethod<[bigint], Result>,
  'setUsername' : ActorMethod<[string], Result>,
  'submitGuess' : ActorMethod<
    [string, number, number, [] | [number], number],
    Result_2
  >,
  'submitPhotoRating' : ActorMethod<
    [
      string,
      bigint,
      bigint,
      { 'interest' : bigint, 'difficulty' : bigint, 'beauty' : bigint },
    ],
    Result_1
  >,
  'updatePhotoInfo' : ActorMethod<
    [
      bigint,
      {
        'title' : string,
        'hint' : string,
        'difficulty' : { 'EASY' : null } |
          { 'HARD' : null } |
          { 'NORMAL' : null } |
          { 'EXTREME' : null },
        'tags' : Array<string>,
        'description' : string,
      },
    ],
    Result
  >,
  'updatePhotoStatsV2' : ActorMethod<[bigint, bigint], Result>,
  'uploadPhotoChunkV2' : ActorMethod<
    [bigint, bigint, Uint8Array | number[]],
    Result
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
