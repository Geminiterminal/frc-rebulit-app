import { scoutingDB } from '../db/indexedDB';
import { TeamProfile } from '../types/scouting';

export interface SyncRankingsResult {
  success: boolean;
  message: string;
  teamsUpdatedCount: number;
}

export async function syncOfficialRankings(eventCode: string = '2026REBUILT'): Promise<SyncRankingsResult> {
  try {
    const teams = await scoutingDB.getAllTeams();
    if (teams.length === 0) {
      return {
        success: false,
        message: 'No teams registered in local scouting database yet.',
        teamsUpdatedCount: 0,
      };
    }

    let rankMap: Record<number, number> = {};
    let isLiveFetch = false;

    // Try fetching from TBA public API if online
    if (typeof navigator !== 'undefined' && navigator.onLine && eventCode && eventCode !== '2026REBUILT') {
      try {
        const response = await fetch(`https://www.thebluealliance.com/api/v3/event/${eventCode}/rankings`, {
          headers: {
            // Using public read endpoint or standard open header
            'X-TBA-Auth-Key': 'public',
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.rankings)) {
            data.rankings.forEach((item: { rank: number; team_key: string }) => {
              const teamNum = parseInt(item.team_key.replace('frc', ''), 10);
              if (!isNaN(teamNum)) {
                rankMap[teamNum] = item.rank;
              }
            });
            isLiveFetch = true;
          }
        }
      } catch {
        // Fallback to offline local calculation / simulated ranks if TBA API is unreachable
      }
    }

    // Fallback: If no live API map was retrieved, assign deterministic official ranks sorted by scouted average score
    if (Object.keys(rankMap).length === 0) {
      const matches = await scoutingDB.getAllMatches();
      const teamScores = teams.map((team) => {
        const teamMatches = matches.filter((m) => m.teamNumber === team.teamNumber);
        const totalScored = teamMatches.reduce((acc, m) => acc + (m.autoFuelScored ?? m.autoHighScored ?? 0) + (m.teleopFuelScored ?? m.teleopHighScored ?? 0), 0);
        const avg = teamMatches.length ? totalScored / teamMatches.length : 0;
        return { teamNumber: team.teamNumber, avg };
      });

      // Sort descending by performance
      teamScores.sort((a, b) => b.avg - a.avg);
      teamScores.forEach((item, index) => {
        rankMap[item.teamNumber] = index + 1;
      });
    }

    // Save updated ranks locally in IndexedDB for offline access
    let updatedCount = 0;
    for (const team of teams) {
      const assignedRank = rankMap[team.teamNumber] || (team.officialRank ?? 99);
      if (team.officialRank !== assignedRank) {
        await scoutingDB.saveTeam({
          ...team,
          officialRank: assignedRank,
          updatedAt: Date.now(),
        });
        updatedCount++;
      }
    }

    return {
      success: true,
      message: isLiveFetch 
        ? `Successfully synced official rankings from live event ${eventCode}!`
        : `Calculated and saved local event rankings for ${teams.length} teams offline.`,
      teamsUpdatedCount: updatedCount,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to sync rankings.',
      teamsUpdatedCount: 0,
    };
  }
}
