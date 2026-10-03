/**
 * The Blue Alliance (TBA) API Integration
 * Fetches event team rosters, event qualification rankings, and state/district rankings.
 */

import { scoutingDB } from '../db/indexedDB';
import { TeamProfile } from '../types/scouting';

export interface TBATeam {
  key: string;
  team_number: number;
  nickname: string;
  city?: string;
  state_prov?: string;
  country?: string;
}

export const tbaApi = {
  async fetchEventTeams(
    eventCode: string,
    authKey: string
  ): Promise<{ success: boolean; count: number; message: string }> {
    const cleanEventCode = eventCode.trim().toLowerCase();
    
    // Decodes the default encoded TBA Key provided by the user
    const defaultEncodedKey = 'cGtIN3Y2Tjgza1NVdnNnTmVSVVY2bmFNQVNxd0dvNDQ0Y1pKdFptQmhOeEdaRWY2UzU3elg5Wnh6aFhtUzJJcg==';
    const decodedDefaultKey = atob(defaultEncodedKey);

    const isValidKey = (key: any): boolean => {
      if (!key) return false;
      const k = String(key).trim();
      return k !== '' && k !== 'null' && k !== 'undefined';
    };
    const cleanAuthKey = isValidKey(authKey) ? String(authKey).trim() : decodedDefaultKey;

    if (!cleanEventCode) {
      return { success: false, count: 0, message: 'Please enter an event code (e.g. 2025mcmp).' };
    }

    try {
      // Save auth key & active event code in settings
      await scoutingDB.setSetting('tbaApiKey', cleanAuthKey);
      localStorage.setItem('frc_tba_auth_key', cleanAuthKey);
      localStorage.setItem('frc_active_event_code', cleanEventCode);

      const fetchWithProxyFallback = async (url: string) => {
        try {
          const directRes = await fetch(url, {
            headers: { 'X-TBA-Auth-Key': cleanAuthKey },
          });
          if (directRes.ok) return await directRes.json();
        } catch (e) {
          // Direct fetch failed
        }
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const proxyRes = await fetch(proxyUrl);
          if (proxyRes.ok) return await proxyRes.json();
        } catch (e) {
          // Proxy failed
        }
        return null;
      };

      // 1. Fetch Event Teams
      const teamsUrl = `https://www.thebluealliance.com/api/v3/event/${cleanEventCode}/teams`;
      const tbaTeams: TBATeam[] = await fetchWithProxyFallback(teamsUrl);

      if (!tbaTeams || !Array.isArray(tbaTeams) || tbaTeams.length === 0) {
        return { success: false, count: 0, message: `Could not fetch teams for "${cleanEventCode}". Check event code & TBA Auth Key.` };
      }

      // Sort teams numerically
      tbaTeams.sort((a, b) => a.team_number - b.team_number);

      // 2. Fetch Event Qualification Rankings (Official Event Rank)
      const eventRankMap: Record<number, number> = {};
      const rankUrl = `https://www.thebluealliance.com/api/v3/event/${cleanEventCode}/rankings`;
      const rankData = await fetchWithProxyFallback(rankUrl);

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
      const eventDetailsUrl = `https://www.thebluealliance.com/api/v3/event/${cleanEventCode}`;
      const eventDetails = await fetchWithProxyFallback(eventDetailsUrl);

      let districtKey: string | null = null;
      if (eventDetails && eventDetails.district && eventDetails.district.key) {
        districtKey = eventDetails.district.key;
      }

      if (!districtKey) {
        // Infer district key from event code (e.g., 2025mcmp -> 2025fim)
        const year = cleanEventCode.slice(0, 4) || '2025';
        if (cleanEventCode.includes('mi') || cleanEventCode.includes('fim') || cleanEventCode.includes('mcmp')) {
          districtKey = `${year}fim`; // Michigan
        } else if (cleanEventCode.includes('ne')) {
          districtKey = `${year}ne`; // New England
        } else if (cleanEventCode.includes('fit') || cleanEventCode.includes('tx')) {
          districtKey = `${year}fit`; // Texas
        } else if (cleanEventCode.includes('fma') || cleanEventCode.includes('mar')) {
          districtKey = `${year}fma`; // Mid-Atlantic
        } else if (cleanEventCode.includes('pnw')) {
          districtKey = `${year}pnw`; // Pacific NW
        } else if (cleanEventCode.includes('ont')) {
          districtKey = `${year}ont`; // Ontario
        }
      }

      if (districtKey) {
        const districtRankUrl = `https://www.thebluealliance.com/api/v3/district/${districtKey}/rankings`;
        const districtRankData = await fetchWithProxyFallback(districtRankUrl);

        if (districtRankData && Array.isArray(districtRankData)) {
          districtRankData.forEach((item: { rank: number; team_key: string }) => {
            const num = parseInt(item.team_key.replace('frc', ''), 10);
            if (!isNaN(num)) {
              stateRankMap[num] = item.rank;
            }
          });
        }
      }

      // 4. Save/update teams in IndexedDB with official & state rankings
      const existingTeams = await scoutingDB.getAllTeams();
      const existingMap = new Map<number, TeamProfile>(existingTeams.map((t) => [t.teamNumber, t]));

      let savedCount = 0;
      let ranksFound = 0;

      for (const t of tbaTeams) {
        const teamNum = t.team_number;
        const existing = existingMap.get(teamNum);

        const officialRank = eventRankMap[teamNum] ?? existing?.officialRank;
        const stateRank = stateRankMap[teamNum] ?? existing?.stateRank;

        if (officialRank !== undefined || stateRank !== undefined) {
          ranksFound++;
        }

        await scoutingDB.saveTeam({
          ...existing,
          teamNumber: teamNum,
          teamName: t.nickname || existing?.teamName || `Team ${teamNum}`,
          officialRank: officialRank,
          stateRank: stateRank,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now(),
        });
        savedCount++;
      }

      return {
        success: true,
        count: savedCount,
        message: `Loaded ${savedCount} teams for event "${cleanEventCode.toUpperCase()}"!`,
      };
    } catch (err: any) {
      return {
        success: false,
        count: 0,
        message: err.message || 'Failed to fetch event teams from TBA.',
      };
    }
  },
};
