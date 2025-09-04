import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Time "mo:base/Time";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Debug "mo:base/Debug";

module {
    // Player statistics that are tracked persistently
    public type PlayerStats = {
        principal: Principal;
        totalGamesPlayed: Nat;
        totalPhotosUploaded: Nat;
        totalRewardsEarned: Nat; // Only includes rewards from finalized sessions
        bestScore: Nat;
        totalScore: Nat; // For calculating average
        totalScore30Days: Nat;
        gamesPlayed30Days: Nat;
        completedGames: Nat;
        totalDuration: Nat; // Total time spent in nanoseconds
        lastUpdated: Time.Time;
        firstGameTime: Time.Time;
        currentStreak: Nat;
        longestStreak: Nat;
        lastGameDate: ?Time.Time;
    };

    public class PlayerStatsManager() {
        // Store player stats
        private var playerStats = HashMap.HashMap<Principal, PlayerStats>(
            10, 
            Principal.equal, 
            Principal.hash
        );

        // Get player stats, creating default if not exists
        public func getPlayerStats(player: Principal) : PlayerStats {
            switch (playerStats.get(player)) {
                case (?stats) { 
                    Debug.print("📊 getPlayerStats - Found existing stats for " # Principal.toText(player));
                    Debug.print("   totalGamesPlayed: " # Nat.toText(stats.totalGamesPlayed));
                    Debug.print("   totalScore: " # Nat.toText(stats.totalScore));
                    stats 
                };
                case null {
                    Debug.print("📊 getPlayerStats - Creating default stats for " # Principal.toText(player));
                    // Return default stats
                    {
                        principal = player;
                        totalGamesPlayed = 0;
                        totalPhotosUploaded = 0;
                        totalRewardsEarned = 0;
                        bestScore = 0;
                        totalScore = 0;
                        totalScore30Days = 0;
                        gamesPlayed30Days = 0;
                        completedGames = 0;
                        totalDuration = 0;
                        lastUpdated = Time.now();
                        firstGameTime = Time.now();
                        currentStreak = 0;
                        longestStreak = 0;
                        lastGameDate = null;
                    }
                };
            }
        };

        // Update stats when a session is finalized
        public func updateStatsOnSessionFinalize(
            player: Principal,
            sessionScore: Nat,
            sessionDuration: Nat,
            rewardEarned: Nat,
            allRoundsCompleted: Bool,
            sessionStartTime: Time.Time
        ) : () {
            Debug.print("📊 updateStatsOnSessionFinalize called for " # Principal.toText(player));
            Debug.print("   sessionScore: " # Nat.toText(sessionScore));
            Debug.print("   rewardEarned: " # Nat.toText(rewardEarned));
            Debug.print("   allRoundsCompleted: " # (if (allRoundsCompleted) "true" else "false"));
            
            let currentStats = getPlayerStats(player);
            Debug.print("   Current totalGamesPlayed: " # Nat.toText(currentStats.totalGamesPlayed));
            Debug.print("   Current totalScore: " # Nat.toText(currentStats.totalScore));
            let now = Time.now();
            let thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1_000_000_000);
            
            // Check if this is a 30-day session
            let isRecent = sessionStartTime >= thirtyDaysAgo;
            
            // Update streak
            let oneDayAgo = now - (24 * 60 * 60 * 1_000_000_000);
            let newStreak = switch (currentStats.lastGameDate) {
                case null { 1 }; // First game
                case (?lastDate) {
                    if (lastDate >= oneDayAgo) {
                        currentStats.currentStreak + 1
                    } else {
                        1 // Streak broken
                    }
                };
            };
            
            let updatedStats : PlayerStats = {
                principal = player;
                totalGamesPlayed = currentStats.totalGamesPlayed + 1;
                totalPhotosUploaded = currentStats.totalPhotosUploaded; // Updated separately
                totalRewardsEarned = currentStats.totalRewardsEarned + rewardEarned;
                bestScore = if (sessionScore > currentStats.bestScore) { sessionScore } else { currentStats.bestScore };
                totalScore = currentStats.totalScore + sessionScore;
                totalScore30Days = if (isRecent) { 
                    currentStats.totalScore30Days + sessionScore 
                } else { 
                    currentStats.totalScore30Days 
                };
                gamesPlayed30Days = if (isRecent) { 
                    currentStats.gamesPlayed30Days + 1 
                } else { 
                    currentStats.gamesPlayed30Days 
                };
                completedGames = if (allRoundsCompleted) { 
                    currentStats.completedGames + 1 
                } else { 
                    currentStats.completedGames 
                };
                totalDuration = currentStats.totalDuration + sessionDuration;
                lastUpdated = now;
                firstGameTime = currentStats.firstGameTime;
                currentStreak = newStreak;
                longestStreak = if (newStreak > currentStats.longestStreak) { 
                    newStreak 
                } else { 
                    currentStats.longestStreak 
                };
                lastGameDate = ?now;
            };
            
            playerStats.put(player, updatedStats);
            Debug.print("📊 Updated player stats for " # Principal.toText(player) # 
                       " - Games: " # Nat.toText(updatedStats.totalGamesPlayed) #
                       ", Rewards: " # Nat.toText(updatedStats.totalRewardsEarned));
        };

        // Update photo upload count
        public func incrementPhotoUploads(player: Principal) : () {
            let currentStats = getPlayerStats(player);
            let updatedStats = {
                currentStats with
                totalPhotosUploaded = currentStats.totalPhotosUploaded + 1;
                lastUpdated = Time.now();
            };
            playerStats.put(player, updatedStats);
            
            Debug.print("📊 Stats updated for " # Principal.toText(player));
            Debug.print("   New totalGamesPlayed: " # Nat.toText(updatedStats.totalGamesPlayed));
            Debug.print("   New totalScore: " # Nat.toText(updatedStats.totalScore));
            Debug.print("   New totalRewardsEarned: " # Nat.toText(updatedStats.totalRewardsEarned));
        };

        // Clean up old 30-day stats (should be called periodically)
        public func cleanupOld30DayStats() : () {
            let now = Time.now();
            let thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1_000_000_000);
            
            // For a full implementation, we'd need to track individual session times
            // and recalculate 30-day stats. For now, this is a placeholder.
            Debug.print("⏰ Cleanup of 30-day stats would happen here");
        };

        // Get all player stats for stable storage
        public func getAllStats() : [(Principal, PlayerStats)] {
            Iter.toArray(playerStats.entries())
        };

        // Restore stats from stable storage
        public func restoreStats(stats: [(Principal, PlayerStats)]) : () {
            playerStats := HashMap.fromIter(
                stats.vals(),
                stats.size(),
                Principal.equal,
                Principal.hash
            );
        };

        // Get top players by total rewards earned
        public func getTopPlayersByRewards(limit: Nat) : [(Principal, Nat)] {
            let allStats = Iter.toArray(playerStats.entries());
            
            // Sort by total rewards earned (descending)
            let sorted = Array.sort(
                allStats,
                func(a: (Principal, PlayerStats), b: (Principal, PlayerStats)) : {#less; #equal; #greater} {
                    if (a.1.totalRewardsEarned > b.1.totalRewardsEarned) { #less }
                    else if (a.1.totalRewardsEarned < b.1.totalRewardsEarned) { #greater }
                    else { #equal }
                }
            );
            
            // Take top N and return just principal and rewards
            let topN = if (sorted.size() > limit) {
                Array.subArray(sorted, 0, limit)
            } else {
                sorted
            };
            
            Array.map<(Principal, PlayerStats), (Principal, Nat)>(
                topN,
                func((p, stats)) = (p, stats.totalRewardsEarned)
            )
        };
    };
}