export const idlFactory = ({ IDL }) => {
  const SessionId = IDL.Text;
  
  const HintType = IDL.Variant({
    BasicRadius: IDL.Null,
    PremiumRadius: IDL.Null,
    DirectionHint: IDL.Null,
  });
  
  const HintContent = IDL.Variant({
    RadiusHint: IDL.Record({
      centerLat: IDL.Float64,
      centerLon: IDL.Float64,
      radius: IDL.Float64,
    }),
    DirectionHint: IDL.Text,
  });
  
  const HintData = IDL.Record({
    hintType: HintType,
    data: HintContent,
  });
  
  const RoundStatus = IDL.Variant({
    Active: IDL.Null,
    Completed: IDL.Null,
    Retried: IDL.Null,
    TimedOut: IDL.Null,
  });
  
  const GuessData = IDL.Record({
    lat: IDL.Float64,
    lon: IDL.Float64,
    azimuth: IDL.Opt(IDL.Float64),
    confidenceRadius: IDL.Float64,
    submittedAt: IDL.Int,
  });
  
  const RoundState = IDL.Record({
    photoId: IDL.Nat,
    status: RoundStatus,
    score: IDL.Nat,
    scoreNorm: IDL.Nat,
    guessData: IDL.Opt(GuessData),
    retryAvailable: IDL.Bool,
    hintsPurchased: IDL.Vec(HintType),
    startTime: IDL.Int,
    endTime: IDL.Opt(IDL.Int),
  });
  
  const SessionResult = IDL.Record({
    sessionId: SessionId,
    userId: IDL.Principal,
    totalScore: IDL.Nat,
    totalScoreNorm: IDL.Nat,
    completedRounds: IDL.Nat,
    totalRounds: IDL.Nat,
    playerReward: IDL.Nat,
    uploaderRewards: IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
    duration: IDL.Nat,
    rank: IDL.Opt(IDL.Nat),
  });
  
  return IDL.Service({
    createSession: IDL.Func([], [IDL.Variant({ ok: SessionId, err: IDL.Text })], []),
    getNextRound: IDL.Func([SessionId], [IDL.Variant({ ok: RoundState, err: IDL.Text })], []),
    submitGuess: IDL.Func(
      [SessionId, IDL.Float64, IDL.Float64, IDL.Opt(IDL.Float64), IDL.Float64],
      [IDL.Variant({ ok: RoundState, err: IDL.Text })],
      []
    ),
    purchaseHint: IDL.Func(
      [SessionId, HintType],
      [IDL.Variant({ ok: HintData, err: IDL.Text })],
      []
    ),
    finalizeSession: IDL.Func(
      [SessionId],
      [IDL.Variant({ ok: SessionResult, err: IDL.Text })],
      []
    ),
  });
};