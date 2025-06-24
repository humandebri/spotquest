export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Result_14 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : IDL.Text });
  const Result_15 = IDL.Variant({
    'ok' : IDL.Record({ 'clearedChunks' : IDL.Nat, 'clearedPhotos' : IDL.Nat }),
    'err' : IDL.Text,
  });
  const RegionCode = IDL.Text;
  const CountryCode = IDL.Text;
  const SceneKind = IDL.Variant({
    'Store' : IDL.Null,
    'Building' : IDL.Null,
    'Nature' : IDL.Null,
    'Facility' : IDL.Null,
    'Other' : IDL.Null,
  });
  const CreatePhotoRequest = IDL.Record({
    'region' : RegionCode,
    'latitude' : IDL.Float64,
    'title' : IDL.Text,
    'country' : CountryCode,
    'hint' : IDL.Text,
    'azimuth' : IDL.Opt(IDL.Float64),
    'difficulty' : IDL.Variant({
      'EASY' : IDL.Null,
      'HARD' : IDL.Null,
      'NORMAL' : IDL.Null,
      'EXTREME' : IDL.Null,
    }),
    'tags' : IDL.Vec(IDL.Text),
    'description' : IDL.Text,
    'totalSize' : IDL.Nat,
    'longitude' : IDL.Float64,
    'sceneKind' : SceneKind,
    'expectedChunks' : IDL.Nat,
  });
  const SessionId = IDL.Text;
  const Result_13 = IDL.Variant({ 'ok' : SessionId, 'err' : IDL.Text });
  const SessionResult = IDL.Record({
    'playerReward' : IDL.Nat,
    'duration' : IDL.Nat,
    'completedRounds' : IDL.Nat,
    'userId' : IDL.Principal,
    'rank' : IDL.Opt(IDL.Nat),
    'uploaderRewards' : IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
    'totalScore' : IDL.Nat,
    'totalRounds' : IDL.Nat,
    'totalScoreNorm' : IDL.Nat,
    'sessionId' : SessionId,
  });
  const Result_12 = IDL.Variant({ 'ok' : SessionResult, 'err' : IDL.Text });
  const Heatmap = IDL.Record({
    'gridSize' : IDL.Nat,
    'bounds' : IDL.Record({
      'minLat' : IDL.Float64,
      'minLon' : IDL.Float64,
      'maxLat' : IDL.Float64,
      'maxLon' : IDL.Float64,
    }),
    'heatmap' : IDL.Vec(IDL.Vec(IDL.Float64)),
    'totalGuesses' : IDL.Nat,
    'photoId' : IDL.Nat,
  });
  const Result_11 = IDL.Variant({ 'ok' : Heatmap, 'err' : IDL.Text });
  const Time = IDL.Int;
  const AggregatedRatings = IDL.Record({
    'interest' : IDL.Record({
      'total' : IDL.Nat,
      'count' : IDL.Nat,
      'average' : IDL.Float64,
    }),
    'difficulty' : IDL.Record({
      'total' : IDL.Nat,
      'count' : IDL.Nat,
      'average' : IDL.Float64,
    }),
    'lastUpdated' : Time,
    'beauty' : IDL.Record({
      'total' : IDL.Nat,
      'count' : IDL.Nat,
      'average' : IDL.Float64,
    }),
    'photoId' : IDL.Nat,
  });
  const HintType = IDL.Variant({
    'PremiumRadius' : IDL.Null,
    'DirectionHint' : IDL.Null,
    'BasicRadius' : IDL.Null,
  });
  const RoundStatus = IDL.Variant({
    'Active' : IDL.Null,
    'Retried' : IDL.Null,
    'TimedOut' : IDL.Null,
    'Completed' : IDL.Null,
  });
  const GuessData = IDL.Record({
    'lat' : IDL.Float64,
    'lon' : IDL.Float64,
    'azimuth' : IDL.Opt(IDL.Float64),
    'confidenceRadius' : IDL.Float64,
    'submittedAt' : Time,
  });
  const RoundState = IDL.Record({
    'hintsPurchased' : IDL.Vec(HintType),
    'startTime' : Time,
    'status' : RoundStatus,
    'endTime' : IDL.Opt(Time),
    'retryAvailable' : IDL.Bool,
    'score' : IDL.Nat,
    'guessData' : IDL.Opt(GuessData),
    'scoreNorm' : IDL.Nat,
    'photoId' : IDL.Nat,
  });
  const Result_10 = IDL.Variant({ 'ok' : RoundState, 'err' : IDL.Text });
  const Guess = IDL.Record({
    'lat' : IDL.Float64,
    'lon' : IDL.Float64,
    'player' : IDL.Principal,
    'dist' : IDL.Float64,
    'timestamp' : Time,
    'sessionId' : IDL.Text,
    'photoId' : IDL.Nat,
  });
  const GeoHash = IDL.Text;
  const ChunkUploadState = IDL.Variant({
    'Failed' : IDL.Null,
    'Complete' : IDL.Null,
    'Incomplete' : IDL.Null,
  });
  const PhotoMetaV2 = IDL.Record({
    'id' : IDL.Nat,
    'region' : RegionCode,
    'status' : IDL.Variant({
      'Active' : IDL.Null,
      'Banned' : IDL.Null,
      'Deleted' : IDL.Null,
    }),
    'latitude' : IDL.Float64,
    'aggregatedRatings' : IDL.Opt(
      IDL.Record({
        'interest' : IDL.Record({
          'total' : IDL.Nat,
          'count' : IDL.Nat,
          'average' : IDL.Float64,
        }),
        'difficulty' : IDL.Record({
          'total' : IDL.Nat,
          'count' : IDL.Nat,
          'average' : IDL.Float64,
        }),
        'lastUpdated' : Time,
        'beauty' : IDL.Record({
          'total' : IDL.Nat,
          'count' : IDL.Nat,
          'average' : IDL.Float64,
        }),
      })
    ),
    'title' : IDL.Text,
    'country' : CountryCode,
    'geoHash' : GeoHash,
    'owner' : IDL.Principal,
    'hint' : IDL.Text,
    'azimuth' : IDL.Opt(IDL.Float64),
    'difficulty' : IDL.Variant({
      'EASY' : IDL.Null,
      'HARD' : IDL.Null,
      'NORMAL' : IDL.Null,
      'EXTREME' : IDL.Null,
    }),
    'tags' : IDL.Vec(IDL.Text),
    'description' : IDL.Text,
    'lastUsedTime' : IDL.Opt(Time),
    'totalSize' : IDL.Nat,
    'qualityScore' : IDL.Float64,
    'timesUsed' : IDL.Nat,
    'longitude' : IDL.Float64,
    'sceneKind' : SceneKind,
    'uploadState' : ChunkUploadState,
    'chunkCount' : IDL.Nat,
    'uploadTime' : Time,
  });
  const Result_9 = IDL.Variant({
    'ok' : IDL.Record({
      'stableChunks' : IDL.Nat,
      'stablePhotos' : IDL.Nat,
      'legacyChunks' : IDL.Nat,
      'legacyPhotos' : IDL.Nat,
    }),
    'err' : IDL.Text,
  });
  const PhotoStats = IDL.Record({
    'playCount' : IDL.Nat,
    'bestScore' : IDL.Nat,
    'worstScore' : IDL.Nat,
    'totalScore' : IDL.Nat,
    'averageScore' : IDL.Float64,
  });
  const OverallPhotoStats = IDL.Record({
    'photosByRegion' : IDL.Vec(IDL.Tuple(RegionCode, IDL.Nat)),
    'photosBySceneKind' : IDL.Vec(IDL.Tuple(SceneKind, IDL.Nat)),
    'activePhotos' : IDL.Nat,
    'popularTags' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat)),
    'totalSize' : IDL.Nat,
    'totalPhotos' : IDL.Nat,
    'photosByCountry' : IDL.Vec(IDL.Tuple(CountryCode, IDL.Nat)),
  });
  const RatingDistribution = IDL.Record({
    'totalRatings' : IDL.Nat,
    'interest' : IDL.Vec(IDL.Nat),
    'difficulty' : IDL.Vec(IDL.Nat),
    'beauty' : IDL.Vec(IDL.Nat),
  });
  const SessionStatus = IDL.Variant({
    'Abandoned' : IDL.Null,
    'Active' : IDL.Null,
    'Completed' : IDL.Null,
  });
  const SessionSummary = IDL.Record({
    'id' : SessionId,
    'status' : SessionStatus,
    'duration' : IDL.Opt(IDL.Nat),
    'currentRound' : IDL.Opt(IDL.Nat),
    'createdAt' : Time,
    'totalScore' : IDL.Nat,
    'roundCount' : IDL.Nat,
  });
  const Result_8 = IDL.Variant({
    'ok' : IDL.Vec(SessionSummary),
    'err' : IDL.Text,
  });
  const Reputation = IDL.Record({
    'uploads' : IDL.Nat,
    'user' : IDL.Principal,
    'lastUpdated' : Time,
    'score' : IDL.Float64,
    'validations' : IDL.Nat,
  });
  const GameSession = IDL.Record({
    'id' : SessionId,
    'startTime' : Time,
    'endTime' : IDL.Opt(Time),
    'currentRound' : IDL.Nat,
    'userId' : IDL.Principal,
    'lastActivity' : Time,
    'totalScore' : IDL.Nat,
    'retryCount' : IDL.Nat,
    'totalScoreNorm' : IDL.Nat,
    'rounds' : IDL.Vec(RoundState),
  });
  const Result_7 = IDL.Variant({ 'ok' : GameSession, 'err' : IDL.Text });
  const SearchResult = IDL.Record({
    'hasMore' : IDL.Bool,
    'cursor' : IDL.Opt(IDL.Nat),
    'totalCount' : IDL.Nat,
    'photos' : IDL.Vec(PhotoMetaV2),
  });
  const SessionInfo = IDL.Record({
    'id' : SessionId,
    'status' : SessionStatus,
    'currentRound' : IDL.Opt(IDL.Nat),
    'createdAt' : Time,
    'players' : IDL.Vec(IDL.Principal),
    'roundCount' : IDL.Nat,
  });
  const Result_6 = IDL.Variant({
    'ok' : IDL.Vec(SessionInfo),
    'err' : IDL.Text,
  });
  const HttpRequest = IDL.Record({
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const HttpResponse = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'status_code' : IDL.Nat16,
  });
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const TransferArgs = IDL.Record({
    'to' : Account,
    'fee' : IDL.Opt(IDL.Nat),
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(Time),
    'amount' : IDL.Nat,
  });
  const TransferError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
    'TemporarilyUnavailable' : IDL.Null,
    'BadBurn' : IDL.Record({ 'min_burn_amount' : IDL.Nat }),
    'Duplicate' : IDL.Record({ 'duplicate_of' : IDL.Nat }),
    'BadFee' : IDL.Record({ 'expected_fee' : IDL.Nat }),
    'CreatedInFuture' : IDL.Record({ 'ledger_time' : IDL.Nat64 }),
    'TooOld' : IDL.Null,
    'InsufficientFunds' : IDL.Record({ 'balance' : IDL.Nat }),
  });
  const Result_5 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : TransferError });
  const Result_4 = IDL.Variant({
    'ok' : IDL.Record({
      'chunksCount' : IDL.Nat,
      'errors' : IDL.Vec(IDL.Text),
      'photosCount' : IDL.Nat,
    }),
    'err' : IDL.Text,
  });
  const HintInfo = IDL.Variant({
    'RadiusHint' : IDL.Nat,
    'DirectionHint' : IDL.Text,
  });
  const Result_3 = IDL.Variant({ 'ok' : HintInfo, 'err' : IDL.Text });
  const SearchFilter = IDL.Record({
    'region' : IDL.Opt(RegionCode),
    'status' : IDL.Opt(
      IDL.Variant({
        'Active' : IDL.Null,
        'Banned' : IDL.Null,
        'Deleted' : IDL.Null,
      })
    ),
    'country' : IDL.Opt(CountryCode),
    'owner' : IDL.Opt(IDL.Principal),
    'difficulty' : IDL.Opt(
      IDL.Variant({
        'EASY' : IDL.Null,
        'HARD' : IDL.Null,
        'NORMAL' : IDL.Null,
        'EXTREME' : IDL.Null,
      })
    ),
    'tags' : IDL.Opt(IDL.Vec(IDL.Text)),
    'sceneKind' : IDL.Opt(SceneKind),
    'nearLocation' : IDL.Opt(
      IDL.Record({
        'latitude' : IDL.Float64,
        'longitude' : IDL.Float64,
        'radiusKm' : IDL.Float64,
      })
    ),
  });
  const RoundResult = IDL.Record({
    'actualLocation' : IDL.Record({ 'lat' : IDL.Float64, 'lon' : IDL.Float64 }),
    'distance' : IDL.Float64,
    'displayScore' : IDL.Nat,
    'normalizedScore' : IDL.Nat,
    'guessLocation' : IDL.Record({ 'lat' : IDL.Float64, 'lon' : IDL.Float64 }),
    'photoId' : IDL.Nat,
  });
  const Result_2 = IDL.Variant({ 'ok' : RoundResult, 'err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  return IDL.Service({
    'adminBanPhoto' : IDL.Func([IDL.Nat], [Result], []),
    'adminBanUser' : IDL.Func([IDL.Principal], [Result], []),
    'adminMint' : IDL.Func([IDL.Principal, IDL.Nat], [Result_14], []),
    'adminUnbanUser' : IDL.Func([IDL.Principal], [Result], []),
    'canRatePhoto' : IDL.Func([IDL.Text, IDL.Nat], [IDL.Bool], ['query']),
    'clearLegacyPhotoData' : IDL.Func([], [Result_15], []),
    'createPhotoV2' : IDL.Func([CreatePhotoRequest], [Result_14], []),
    'createSession' : IDL.Func([], [Result_13], []),
    'debugCalculatePlayerReward' : IDL.Func(
        [IDL.Text],
        [
          IDL.Record({
            'roundDetails' : IDL.Vec(IDL.Tuple(IDL.Nat, IDL.Nat)),
            'totalScore' : IDL.Nat,
            'sessionFound' : IDL.Bool,
            'totalReward' : IDL.Nat,
            'roundCount' : IDL.Nat,
          }),
        ],
        ['query'],
      ),
    'debugGetPlayerSessions' : IDL.Func(
        [IDL.Principal],
        [
          IDL.Record({
            'totalCompleted' : IDL.Nat,
            'sessionIds' : IDL.Vec(IDL.Text),
            'sessions' : IDL.Vec(
              IDL.Record({
                'id' : IDL.Text,
                'currentRound' : IDL.Nat,
                'totalScore' : IDL.Nat,
                'hasEndTime' : IDL.Bool,
                'rounds' : IDL.Nat,
              })
            ),
          }),
        ],
        ['query'],
      ),
    'debugPhotoMigrationStatus' : IDL.Func(
        [],
        [
          IDL.Record({
            'stableChunks' : IDL.Nat,
            'stablePhotos' : IDL.Nat,
            'legacyChunks' : IDL.Nat,
            'legacyPhotos' : IDL.Nat,
          }),
        ],
        ['query'],
      ),
    'debugPhotoStorage' : IDL.Func(
        [],
        [
          IDL.Record({
            'stablePhotosCount' : IDL.Nat,
            'storageSize' : IDL.Nat,
            'firstPhotoIds' : IDL.Vec(IDL.Nat),
            'stableChunksCount' : IDL.Nat,
            'totalPhotos' : IDL.Nat,
            'nextPhotoId' : IDL.Nat,
          }),
        ],
        ['query'],
      ),
    'deletePhotoV2' : IDL.Func([IDL.Nat], [Result], []),
    'finalizePhotoUploadV2' : IDL.Func([IDL.Nat], [Result], []),
    'finalizeSession' : IDL.Func([IDL.Text], [Result_12], []),
    'generateHeatmap' : IDL.Func([IDL.Nat], [Result_11], ['query']),
    'getLeaderboard' : IDL.Func(
        [IDL.Nat],
        [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat))],
        ['query'],
      ),
    'getLeaderboardWithStats' : IDL.Func(
        [IDL.Nat],
        [
          IDL.Vec(
            IDL.Tuple(
              IDL.Principal,
              IDL.Record({
                'photosUploaded' : IDL.Nat,
                'username' : IDL.Opt(IDL.Text),
                'gamesPlayed' : IDL.Nat,
                'totalRewards' : IDL.Nat,
                'score' : IDL.Nat,
              }),
            )
          ),
        ],
        ['query'],
      ),
    'getMultiplePhotoRatings' : IDL.Func(
        [IDL.Vec(IDL.Nat)],
        [IDL.Vec(IDL.Tuple(IDL.Nat, IDL.Opt(AggregatedRatings)))],
        ['query'],
      ),
    'getNextRound' : IDL.Func([IDL.Text, IDL.Opt(IDL.Text)], [Result_10], []),
    'getOwner' : IDL.Func([], [IDL.Principal], ['query']),
    'getPhotoChunkV2' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [IDL.Opt(IDL.Vec(IDL.Nat8))],
        ['query'],
      ),
    'getPhotoCompleteDataV2' : IDL.Func(
        [IDL.Nat],
        [IDL.Opt(IDL.Vec(IDL.Nat8))],
        ['query'],
      ),
    'getPhotoGuesses' : IDL.Func(
        [IDL.Nat, IDL.Opt(IDL.Nat)],
        [IDL.Vec(Guess)],
        ['query'],
      ),
    'getPhotoMetadataV2' : IDL.Func(
        [IDL.Nat],
        [IDL.Opt(PhotoMetaV2)],
        ['query'],
      ),
    'getPhotoMigrationStatus' : IDL.Func([], [Result_9], ['query']),
    'getPhotoRatings' : IDL.Func(
        [IDL.Nat],
        [IDL.Opt(AggregatedRatings)],
        ['query'],
      ),
    'getPhotoStatsDetailsV2' : IDL.Func(
        [IDL.Nat],
        [IDL.Opt(PhotoStats)],
        ['query'],
      ),
    'getPhotoStatsV2' : IDL.Func([], [OverallPhotoStats], ['query']),
    'getPlayerHistory' : IDL.Func(
        [IDL.Principal, IDL.Opt(IDL.Nat)],
        [IDL.Vec(IDL.Nat)],
        ['query'],
      ),
    'getPlayerRank' : IDL.Func([IDL.Principal], [IDL.Opt(IDL.Nat)], ['query']),
    'getPlayerStats' : IDL.Func(
        [IDL.Principal],
        [
          IDL.Record({
            'rank' : IDL.Opt(IDL.Nat),
            'totalGamesPlayed' : IDL.Nat,
            'averageDuration' : IDL.Nat,
            'reputation' : IDL.Float64,
            'bestScore' : IDL.Nat,
            'suspiciousActivityFlags' : IDL.Opt(IDL.Text),
            'totalGuesses' : IDL.Nat,
            'totalPhotosUploaded' : IDL.Nat,
            'totalRewardsEarned' : IDL.Nat,
            'longestStreak' : IDL.Nat,
            'averageScore30Days' : IDL.Opt(IDL.Nat),
            'winRate' : IDL.Float64,
            'averageScore' : IDL.Nat,
            'currentStreak' : IDL.Nat,
          }),
        ],
        ['query'],
      ),
    'getRatingDistribution' : IDL.Func(
        [IDL.Nat],
        [IDL.Opt(RatingDistribution)],
        ['query'],
      ),
    'getRatingStats' : IDL.Func(
        [],
        [
          IDL.Record({
            'totalRatings' : IDL.Nat,
            'totalRatingUsers' : IDL.Nat,
            'totalRatedPhotos' : IDL.Nat,
          }),
        ],
        ['query'],
      ),
    'getRecentSessionsWithScores' : IDL.Func(
        [IDL.Principal, IDL.Nat],
        [Result_8],
        ['query'],
      ),
    'getReputation' : IDL.Func([IDL.Principal], [Reputation], ['query']),
    'getReputationLeaderboard' : IDL.Func(
        [IDL.Nat],
        [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Float64))],
        ['query'],
      ),
    'getSession' : IDL.Func([IDL.Text], [Result_7], ['query']),
    'getSinkHistory' : IDL.Func(
        [IDL.Opt(IDL.Nat)],
        [IDL.Vec(IDL.Tuple(Time, IDL.Text, IDL.Nat))],
        ['query'],
      ),
    'getSystemStats' : IDL.Func(
        [],
        [
          IDL.Record({
            'gameMetrics' : IDL.Record({
              'totalRounds' : IDL.Nat,
              'errorCount' : IDL.Nat,
              'totalSessions' : IDL.Nat,
              'totalRequests' : IDL.Nat,
            }),
            'totalSupply' : IDL.Nat,
            'totalGuesses' : IDL.Nat,
            'totalUsers' : IDL.Nat,
            'totalPhotos' : IDL.Nat,
            'totalSessions' : IDL.Nat,
            'photoStats' : IDL.Record({
              'bannedPhotos' : IDL.Nat,
              'activePhotos' : IDL.Nat,
              'totalPhotos' : IDL.Nat,
              'deletedPhotos' : IDL.Nat,
            }),
          }),
        ],
        ['query'],
      ),
    'getTopPhotosByUsage' : IDL.Func(
        [IDL.Nat],
        [
          IDL.Vec(
            IDL.Tuple(
              IDL.Nat,
              IDL.Record({
                'title' : IDL.Text,
                'owner' : IDL.Principal,
                'timesUsed' : IDL.Nat,
                'photoId' : IDL.Nat,
              }),
            )
          ),
        ],
        ['query'],
      ),
    'getTopUploaders' : IDL.Func(
        [IDL.Nat],
        [
          IDL.Vec(
            IDL.Tuple(
              IDL.Principal,
              IDL.Record({
                'username' : IDL.Opt(IDL.Text),
                'totalTimesUsed' : IDL.Nat,
                'totalPhotos' : IDL.Nat,
              }),
            )
          ),
        ],
        ['query'],
      ),
    'getTreasuryStats' : IDL.Func(
        [],
        [
          IDL.Record({
            'balance' : IDL.Nat,
            'totalSunk' : IDL.Nat,
            'totalBurned' : IDL.Nat,
          }),
        ],
        ['query'],
      ),
    'getUserPhotosV2' : IDL.Func(
        [IDL.Opt(IDL.Nat), IDL.Nat],
        [SearchResult],
        ['query'],
      ),
    'getUserRatingHistory' : IDL.Func(
        [IDL.Opt(IDL.Nat)],
        [IDL.Vec(IDL.Nat)],
        ['query'],
      ),
    'getUserRatingStats' : IDL.Func(
        [],
        [
          IDL.Record({
            'totalRatings' : IDL.Nat,
            'averageBeauty' : IDL.Float64,
            'averageInterest' : IDL.Float64,
            'averageDifficulty' : IDL.Float64,
          }),
        ],
        ['query'],
      ),
    'getUserRatingStatus' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Nat)],
        [IDL.Vec(IDL.Tuple(IDL.Nat, IDL.Bool))],
        ['query'],
      ),
    'getUserSessions' : IDL.Func([IDL.Principal], [Result_6], ['query']),
    'getUsername' : IDL.Func([IDL.Principal], [IDL.Opt(IDL.Text)], ['query']),
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'http_request_update' : IDL.Func([HttpRequest], [HttpResponse], []),
    'icrc1_balance_of' : IDL.Func([Account], [IDL.Nat], ['query']),
    'icrc1_decimals' : IDL.Func([], [IDL.Nat8], ['query']),
    'icrc1_fee' : IDL.Func([], [IDL.Nat], ['query']),
    'icrc1_name' : IDL.Func([], [IDL.Text], ['query']),
    'icrc1_symbol' : IDL.Func([], [IDL.Text], ['query']),
    'icrc1_total_supply' : IDL.Func([], [IDL.Nat], ['query']),
    'icrc1_transfer' : IDL.Func([TransferArgs], [Result_5], []),
    'init' : IDL.Func([], [Result], []),
    'migrateLegacyPhotoData' : IDL.Func([], [Result_4], []),
    'purchaseHint' : IDL.Func([IDL.Text, HintType], [Result_3], []),
    'searchPhotosV2' : IDL.Func(
        [SearchFilter, IDL.Opt(IDL.Nat), IDL.Nat],
        [SearchResult],
        ['query'],
      ),
    'setPlayFee' : IDL.Func([IDL.Nat], [Result], []),
    'setUsername' : IDL.Func([IDL.Text], [Result], []),
    'submitGuess' : IDL.Func(
        [IDL.Text, IDL.Float64, IDL.Float64, IDL.Opt(IDL.Float64), IDL.Float64],
        [Result_2],
        [],
      ),
    'submitPhotoRating' : IDL.Func(
        [
          IDL.Text,
          IDL.Nat,
          IDL.Nat,
          IDL.Record({
            'interest' : IDL.Nat,
            'difficulty' : IDL.Nat,
            'beauty' : IDL.Nat,
          }),
        ],
        [Result_1],
        [],
      ),
    'updatePhotoInfo' : IDL.Func(
        [
          IDL.Nat,
          IDL.Record({
            'title' : IDL.Text,
            'hint' : IDL.Text,
            'difficulty' : IDL.Variant({
              'EASY' : IDL.Null,
              'HARD' : IDL.Null,
              'NORMAL' : IDL.Null,
              'EXTREME' : IDL.Null,
            }),
            'tags' : IDL.Vec(IDL.Text),
            'description' : IDL.Text,
          }),
        ],
        [Result],
        [],
      ),
    'updatePhotoStatsV2' : IDL.Func([IDL.Nat, IDL.Nat], [Result], []),
    'uploadPhotoChunkV2' : IDL.Func(
        [IDL.Nat, IDL.Nat, IDL.Vec(IDL.Nat8)],
        [Result],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
