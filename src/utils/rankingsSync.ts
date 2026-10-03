import { scoutingDB } from '../db/indexedDB';
import { TeamProfile } from '../types/scouting';

export interface SyncRankingsResult {
  success: boolean;
  message: string;
  teamsUpdatedCount: number;
}

/**
 * Format event code properly.
 * E.g., 'micmp' -> '2025micmp', '2024micmp' -> '2024micmp'
 */
export function normalizeEventCode(code: string): string {
  let clean = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return '';
  // If no year prefix, add default current year 2025
  if (!/^\d{4}/.test(clean)) {
    clean = `2025${clean}`;
  }
  return clean;
}

/**
 * Robust JSON fetch with TBA API key and CORS Proxy fallback
 */
async function fetchTbaData(endpointUrl: string, apiKey: string): Promise<any> {
  // 1. Direct fetch if apiKey is supplied or standard fetch
  const headers: Record<string, string> = apiKey ? { 'X-TBA-Auth-Key': apiKey } : {};

  try {
    const directRes = await fetch(endpointUrl, { headers });
    if (directRes.ok) {
      return await directRes.json();
    }
  } catch (e) {
    // Direct fetch failed (e.g. CORS block)
  }

  // 2. Fallback via CORS proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(endpointUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      return await proxyRes.json();
    }
  } catch (e) {
    // Proxy fetch failed
  }

  return null;
}

export async function importEventRosterAndRankings(eventCodeInput: string = '2025micmp'): Promise<SyncRankingsResult> {
  try {
    const cleanCode = normalizeEventCode(eventCodeInput);
    if (!cleanCode) {
      return {
        success: false,
        message: 'Please enter a valid competition event code (e.g. 2025micmp, 2024cmp, 2025mifor).',
        teamsUpdatedCount: 0,
      };
    }

    const storedKey = await scoutingDB.getSetting<string>('tbaApiKey', '');
    const apiKey = storedKey.trim();

    if (typeof navigator === 'undefined' || !navigator.onLine) {
      return {
        success: false,
        message: 'Offline: Cannot fetch live event roster without network connection.',
        teamsUpdatedCount: 0,
      };
    }

    // 1. Fetch Event Teams
    const teamsUrl = `https://www.thebluealliance.com/api/v3/event/${cleanCode}/teams`;
    const fetchedTeams: Array<{
      team_number: number;
      nickname?: string;
      city?: string;
      state_prov?: string;
    }> = await fetchTbaData(teamsUrl, apiKey);

    if (!fetchedTeams || !Array.isArray(fetchedTeams) || fetchedTeams.length === 0) {
      return {
        success: false,
        message: `Could not fetch event data for "${cleanCode}". Verify event code and TBA Auth Key in Settings.`,
        teamsUpdatedCount: 0,
      };
    }

    // 2. Fetch Event Qualification Rankings
    const eventRankMap: Record<number, number> = {};
    const rankUrl = `https://www.thebluealliance.com/api/v3/event/${cleanCode}/rankings`;
    const rankData = await fetchTbaData(rankUrl, apiKey);

    if (rankData && Array.isArray(rankData.rankings)) {
      rankData.rankings.forEach((item: { rank: number; team_key: string }) => {
        const num = parseInt(item.team_key.replace('frc', ''), 10);
        if (!isNaN(num)) {
          eventRankMap[num] = item.rank;
        }
      });
    }

    // 3. Fetch Event Details to get District Key for State/District Rankings
    const stateRankMap: Record<number, number> = {};
    const eventDetailsUrl = `https://www.thebluealliance.com/api/v3/event/${cleanCode}`;
    const eventDetails = await fetchTbaData(eventDetailsUrl, apiKey);

    let districtKey: string | null = null;
    if (eventDetails && eventDetails.district && eventDetails.district.key) {
      districtKey = eventDetails.district.key;
    } else {
      // Infer district from event code prefix/suffix (e.g., 2025fim, 2025micmp -> 2025fim)
      const year = cleanCode.slice(0, 4);
      if (cleanCode.includes('mi') || cleanCode.includes('fim')) {
        districtKey = `${year}fim`; // FIRST in Michigan
      } else if (cleanCode.includes('ne')) {
        districtKey = `${year}ne`; // New England
      } else if (cleanCode.includes('fit') || cleanCode.includes('tx')) {
        districtKey = `${year}fit`; // FIRST in Texas
      } else if (cleanCode.includes('fma') || cleanCode.includes('mar')) {
        districtKey = `${year}fma`; // Mid-Atlantic
      } else if (cleanCode.includes('pnw')) {
        districtKey = `${year}pnw`; // Pacific NW
      } else if (cleanCode.includes('ont')) {
        districtKey = `${year}ont`; // Ontario
      }
    }

    if (districtKey) {
      const districtRankUrl = `https://www.thebluealliance.com/api/v3/district/${districtKey}/rankings`;
      const districtRankData = await fetchTbaData(districtRankUrl, apiKey);

      if (Array.isArray(districtRankData)) {
        districtRankData.forEach((item: { rank: number; team_key: string }) => {
          const num = parseInt(item.team_key.replace('frc', ''), 10);
          if (!isNaN(num)) {
            stateRankMap[num] = item.rank;
          }
        });
      }
    }

    // 4. Save/seed team profiles into IndexedDB
    let savedCount = 0;
    const existingTeams = await scoutingDB.getAllTeams();
    const existingMap = new Map<number, TeamProfile>(existingTeams.map((t) => [t.teamNumber, t]));

    for (const item of fetchedTeams) {
      const teamNum = item.team_number;
      const existing = existingMap.get(teamNum);
      const locationStr = item.city && item.state_prov ? `${item.city}, ${item.state_prov}` : item.state_prov || '';

      const officialRank = eventRankMap[teamNum];
      const stateRank = stateRankMap[teamNum];

      const updatedProfile: TeamProfile = {
        teamNumber: teamNum,
        teamName: item.nickname || existing?.teamName || `Team ${teamNum}`,
        location: locationStr || existing?.location,
        officialRank: officialRank !== undefined ? officialRank : existing?.officialRank,
        stateRank: stateRank !== undefined ? stateRank : existing?.stateRank,
        pit: existing?.pit,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await scoutingDB.saveTeam(updatedProfile);
      savedCount++;
    }

    const stateCount = Object.keys(stateRankMap).length;
    return {
      success: true,
      message: `Successfully imported ${savedCount} teams! Attached event ranks & ${stateCount} state/district ranks.`,
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

// Bulk manual import helper for entering team numbers directly
export async function bulkImportTeams(teamNumbersInput: string): Promise<SyncRankingsResult> {
  const numbers = teamNumbersInput
    .split(/[\s,;]+/)
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  if (numbers.length === 0) {
    return {
      success: false,
      message: 'No valid team numbers detected.',
      teamsUpdatedCount: 0,
    };
  }

  const existing = await scoutingDB.getAllTeams();
  const existingMap = new Map(existing.map((t) => [t.teamNumber, t]));
  let count = 0;

  for (const num of numbers) {
    if (!existingMap.has(num)) {
      await scoutingDB.saveTeam({
        teamNumber: num,
        teamName: `Team ${num}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      count++;
    }
  }

  return {
    success: true,
    message: `Added ${count} new teams to the event roster.`,
    teamsUpdatedCount: count,
  };
}

export const syncOfficialRankings = importEventRosterAndRankings;
