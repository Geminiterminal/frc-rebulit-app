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
        const apiKey = (await scoutingDB.getSetting<string>('tbaApiKey', '')) || 'public';
        const response = await fetch(`https://www.thebluealliance.com/api/v3/event/${eventCode}/rankings`, {
          headers: {
            'X-TBA-Auth-Key': apiKey,
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
        // Fetch issue - fallback to keeping existing manual/saved ranks or N/A
      }
    }

    if (!isLiveFetch || Object.keys(rankMap).length === 0) {
      return {
        success: false,
        message: `Could not fetch live ranks for event "${eventCode}". Unmatched teams will display N/A. You can manually enter official ranks anytime.`,
        teamsUpdatedCount: 0,
      };
    }

    // Save updated live ranks locally in IndexedDB for offline access
    let updatedCount = 0;
    for (const team of teams) {
      if (rankMap[team.teamNumber] !== undefined) {
        const newRank = rankMap[team.teamNumber];
        if (team.officialRank !== newRank) {
          await scoutingDB.saveTeam({
            ...team,
            officialRank: newRank,
            updatedAt: Date.now(),
          });
          updatedCount++;
        }
      }
    }

    return {
      success: true,
      message: `Successfully synced ${updatedCount} official team ranks from live event ${eventCode}!`,
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
