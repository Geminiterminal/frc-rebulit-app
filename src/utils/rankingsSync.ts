import { scoutingDB } from '../db/indexedDB';
import { TeamProfile } from '../types/scouting';

export interface SyncRankingsResult {
  success: boolean;
  message: string;
  teamsUpdatedCount: number;
}

export async function importEventRosterAndRankings(eventCode: string = '2026REBUILT'): Promise<SyncRankingsResult> {
  try {
    const cleanCode = eventCode.trim().toLowerCase();
    if (!cleanCode || cleanCode === '2026rebuilt') {
      return {
        success: false,
        message: 'Enter a valid competition event code (e.g. 2026micmp, 2026cmp, 2026mifor) to import teams.',
        teamsUpdatedCount: 0,
      };
    }

    let isLiveFetch = false;
    let fetchedTeams: Array<{
      team_number: number;
      nickname?: string;
      city?: string;
      state_prov?: string;
    }> = [];
    let rankMap: Record<number, number> = {};

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const apiKey = (await scoutingDB.getSetting<string>('tbaApiKey', '')) || 'public';
      const headers = { 'X-TBA-Auth-Key': apiKey };

      try {
        // 1. Fetch Event Teams Roster
        const teamsRes = await fetch(`https://www.thebluealliance.com/api/v3/event/${cleanCode}/teams`, { headers });
        if (teamsRes.ok) {
          fetchedTeams = await teamsRes.json();
          isLiveFetch = true;
        }

        // 2. Fetch Event Rankings
        const rankRes = await fetch(`https://www.thebluealliance.com/api/v3/event/${cleanCode}/rankings`, { headers });
        if (rankRes.ok) {
          const rankData = await rankRes.json();
          if (rankData && Array.isArray(rankData.rankings)) {
            rankData.rankings.forEach((item: { rank: number; team_key: string }) => {
              const num = parseInt(item.team_key.replace('frc', ''), 10);
              if (!isNaN(num)) {
                rankMap[num] = item.rank;
              }
            });
          }
        }
      } catch (e) {
        console.warn('Network error fetching event roster:', e);
      }
    }

    if (!isLiveFetch || fetchedTeams.length === 0) {
      return {
        success: false,
        message: `Could not reach live roster for event "${eventCode}". Verify network connection & event code. Unmatched teams remain N/A.`,
        teamsUpdatedCount: 0,
      };
    }

    // Save/seed team profiles into IndexedDB
    let savedCount = 0;
    const existingTeams = await scoutingDB.getAllTeams();
    const existingMap = new Map<number, TeamProfile>(existingTeams.map((t) => [t.teamNumber, t]));

    for (const item of fetchedTeams) {
      const teamNum = item.team_number;
      const existing = existingMap.get(teamNum);
      const locationStr = item.city && item.state_prov ? `${item.city}, ${item.state_prov}` : item.state_prov || '';
      const officialRank = rankMap[teamNum];

      const updatedProfile: TeamProfile = {
        teamNumber: teamNum,
        teamName: item.nickname || existing?.teamName || `Team ${teamNum}`,
        location: locationStr || existing?.location,
        officialRank: officialRank !== undefined ? officialRank : existing?.officialRank,
        pit: existing?.pit,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await scoutingDB.saveTeam(updatedProfile);
      savedCount++;
    }

    return {
      success: true,
      message: `Successfully imported ${savedCount} teams & official ranks from event "${eventCode}"!`,
      teamsUpdatedCount: savedCount,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to import event roster.',
      teamsUpdatedCount: 0,
    };
  }
}

// Backward compatibility alias for sync button
export const syncOfficialRankings = importEventRosterAndRankings;
