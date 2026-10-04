/**
 * Optimized QR Code Assignment & Scout-Data Transfer Engine
 * Compact payload encoding for instant, ultra-fast camera scanning without bloat.
 */

import { scoutingDB } from '../db/indexedDB';
import { scoutingAssignments, MatchScoutTask, MatchTarget } from '../db/scoutingAssignments';
import { MatchScoutingRecord, PitData } from '../types/scouting';

export interface AssignmentPayload {
  type: 'ASSIGNMENT';
  scoutId: string;
  scoutRole: 'PIT_SCOUT' | 'MATCH_SCOUT';
  assignedTeams: number[];
  matchTasks?: MatchScoutTask[];
  timestamp: number;
}

export interface ScoutDataRecord {
  type: 'PIT' | 'MATCH';
  id: string;
  teamNumber: number;
  matchNumber?: number;
  data: PitData | MatchScoutingRecord;
}

// Compact minifier to strip empty values and optimize QR payload density
function cleanEmptyFields(obj: any): any {
  if (Array.isArray(obj)) {
    const cleanedArr = obj.map(cleanEmptyFields).filter((v) => v !== null && v !== undefined && v !== '');
    return cleanedArr.length > 0 ? cleanedArr : undefined;
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    let hasKeys = false;
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'thumbnailDataUrl' || key === 'photos' || key === 'dataUrl') {
        continue;
      }

      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'object' && Object.keys(value).length === 0) continue;

      if (key === 'points' && Array.isArray(value)) {
        cleaned[key] = downsamplePoints(value);
        hasKeys = true;
        continue;
      }

      const child = cleanEmptyFields(value);
      if (child !== null && child !== undefined && child !== '') {
        if (['autoHighScored', 'teleopHighScored', 'notes', 'hangStatus'].includes(key)) {
          continue;
        }

        if ((key === 'x' || key === 'y') && typeof child === 'number') {
          cleaned[key] = Math.round(child * 10) / 10;
        } else {
          cleaned[key] = child;
        }
        hasKeys = true;
      }
    }
    return hasKeys ? cleaned : undefined;
  }
  return obj;
}

function downsamplePoints(points: any[]): any[] {
  if (!Array.isArray(points)) return [];
  const maxPoints = 12;
  if (points.length <= maxPoints) {
    return points.map((p) => ({
      x: typeof p.x === 'number' ? Math.round(p.x * 10) / 10 : p.x,
      y: typeof p.y === 'number' ? Math.round(p.y * 10) / 10 : p.y,
    }));
  }
  const step = (points.length - 1) / (maxPoints - 1);
  const result = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    const p = points[idx];
    if (p) {
      result.push({
        x: typeof p.x === 'number' ? Math.round(p.x * 10) / 10 : p.x,
        y: typeof p.y === 'number' ? Math.round(p.y * 10) / 10 : p.y,
      });
    }
  }
  return result;
}

export const qrTransferEngine = {
  /**
   * Generate Assignment QR Payload
   */
  generateAssignmentPayload(
    scoutId: string,
    scoutRole: 'PIT_SCOUT' | 'MATCH_SCOUT',
    assignedTeams: number[],
    matchNumber?: number,
    matchTargets?: MatchTarget[]
  ): string {
    const payload = {
      t: 'A',
      s: scoutId,
      r: scoutRole === 'PIT_SCOUT' ? 'P' : 'M',
      tm: assignedTeams,
      mn: matchNumber,
      mt: matchTargets && matchTargets.length > 0 
        ? matchTargets.map((task) => [
            task.matchNumber, 
            task.teamNumber, 
            task.alliance === 'red' ? 'R' : task.alliance === 'blue' ? 'B' : ''
          ]) 
        : undefined,
      ts: Date.now(),
    };
    return JSON.stringify(payload);
  },

  /**
   * Parse Assignment QR code string
   */
  parseAssignmentPayload(qrString: string): { success: boolean; scoutId: string; role: string; message: string } {
    try {
      const parsed: any = JSON.parse(qrString.trim());
      const isCompact = parsed.t === 'A';
      const isLegacy = parsed.type === 'ASSIGNMENT';

      if (!isCompact && !isLegacy) {
        throw new Error('Invalid Assignment QR format.');
      }

      const scoutId = (isCompact ? parsed.s : parsed.scoutId) || 'Scout';
      const scoutRole: 'PIT_SCOUT' | 'MATCH_SCOUT' = (isCompact ? (parsed.r === 'P' ? 'PIT_SCOUT' : 'MATCH_SCOUT') : parsed.scoutRole) || 'PIT_SCOUT';
      const assignedTeams: number[] = (isCompact ? parsed.tm : parsed.assignedTeams) || [];

      let matchTasks: MatchScoutTask[] = [];
      if (isCompact && Array.isArray(parsed.mt)) {
        matchTasks = parsed.mt.map((pair: any[]) => ({
          matchNumber: Number(pair[0]),
          teamNumber: Number(pair[1]),
          alliance: pair[2] === 'R' ? 'red' : pair[2] === 'B' ? 'blue' : undefined,
        }));
      } else if (Array.isArray(parsed.matchTasks)) {
        matchTasks = parsed.matchTasks;
      }

      // Update scout profile
      const currentProfile = scoutingAssignments.getProfile();
      scoutingAssignments.setProfile({
        name: scoutId || currentProfile.name || 'Scout',
        position: scoutRole,
        isSetupComplete: true,
      });

      // Get existing tasks and teams to preserve them
      const existingMatchTasks = scoutingAssignments.getMyMatchTasks();
      const existingTargetTeams = scoutingAssignments.getMyTargetTeams();

      // Merge match tasks without losing previous ones
      const mergedMatchTasks = [...existingMatchTasks];
      for (const mt of matchTasks) {
        const idx = mergedMatchTasks.findIndex(
          (e) => e.matchNumber === mt.matchNumber && e.teamNumber === mt.teamNumber
        );
        if (idx >= 0) {
          mergedMatchTasks[idx] = { ...mergedMatchTasks[idx], ...mt };
        } else {
          mergedMatchTasks.push(mt);
        }
      }

      // Merge pit target teams without losing previous ones
      const newTeamNums = matchTasks.map((t) => t.teamNumber);
      const mergedTargetTeams = Array.from(
        new Set([...existingTargetTeams, ...assignedTeams, ...newTeamNums])
      ).filter((t) => Number.isInteger(t) && t > 0);

      scoutingAssignments.setMyMatchTasks(mergedMatchTasks);
      scoutingAssignments.setMyTargetTeams(mergedTargetTeams);
      scoutingAssignments.assignScout(scoutId, scoutRole, mergedTargetTeams, mergedMatchTasks);

      const newMatchCount = matchTasks.length;
      const newPitCount = assignedTeams.length;
      const totalMatchTasks = mergedMatchTasks.length;
      const totalPitTeams = mergedTargetTeams.length;

      let summaryText = '';
      if (newMatchCount > 0 && newPitCount > 0) {
        summaryText = `Added ${newMatchCount} match task(s) & ${newPitCount} pit team(s) (Total: ${totalMatchTasks} match, ${totalPitTeams} pit)`;
      } else if (newMatchCount > 0) {
        summaryText = `Added ${newMatchCount} match task(s) (Total: ${totalMatchTasks} match tasks)`;
      } else {
        summaryText = `Added ${newPitCount} pit team(s) (Total: ${totalPitTeams} pit teams)`;
      }

      return {
        success: true,
        scoutId,
        role: scoutRole,
        message: `Updated assignments for ${scoutId}: ${summaryText}`,
      };
    } catch (err: any) {
      return {
        success: false,
        scoutId: '',
        role: '',
        message: err.message || 'Failed to parse assignment QR.',
      };
    }
  },

  /**
   * Generate a standard single-record QR payload for PIT scouting
   */
  generateSinglePitQr(scoutId: string, teamNumber: number, pitData: PitData): string {
    const cleanedPit = cleanEmptyFields(pitData);
    const payload = {
      t: 'SD',
      s: scoutId,
      c: 0,
      tc: 1,
      r: [{
        t: 'P',
        id: `pit-${teamNumber}`,
        tn: teamNumber,
        d: cleanedPit || {},
      }],
      ts: Date.now(),
    };
    return JSON.stringify(payload);
  },

  /**
   * Generate a standard single-record QR payload for MATCH scouting
   */
  generateSingleMatchQr(scoutId: string, matchRecord: MatchScoutingRecord): string {
    const record = {
      ...matchRecord,
      id: matchRecord.id || `match-${matchRecord.matchNumber}-${matchRecord.teamNumber}`
    };
    const { autoHighScored, teleopHighScored, notes, hangStatus, ...sanitizedRecord } = record as any;
    const cleanedMatch = cleanEmptyFields(sanitizedRecord);
    const payload = {
      t: 'SD',
      s: scoutId,
      c: 0,
      tc: 1,
      r: [{
        t: 'M',
        id: sanitizedRecord.id,
        tn: sanitizedRecord.teamNumber,
        mn: sanitizedRecord.matchNumber,
        d: cleanedMatch || {},
      }],
      ts: Date.now(),
    };
    return JSON.stringify(payload);
  },

  /**
   * Import Scout Data QR Code payload with duplicate prevention
   */
  async importScoutDataQrPayload(qrString: string): Promise<{ success: boolean; importedCount: number; duplicateCount: number; message: string }> {
    try {
      const parsed: any = JSON.parse(qrString.trim());
      const isCompact = parsed.t === 'SD';
      const isLegacy = parsed.type === 'SCOUT_DATA';

      if (!isCompact && !isLegacy) {
        throw new Error('Invalid Scout Data QR format.');
      }

      const recordsList: any[] = (isCompact ? parsed.r : parsed.records) || [];
      if (recordsList.length === 0) {
        return {
          success: true,
          importedCount: 0,
          duplicateCount: 0,
          message: 'QR Code scanned (Empty payload).',
        };
      }

      let importedCount = 0;
      let duplicateCount = 0;

      for (const rec of recordsList) {
        const recType = isCompact ? (rec.t === 'P' ? 'PIT' : 'MATCH') : rec.type;
        const teamNum = isCompact ? rec.tn : rec.teamNumber;
        const recData = isCompact ? rec.d : rec.data;
        const recId = rec.id || `${recType}-${teamNum}`;

        if (recType === 'PIT') {
          const pitData = recData as PitData;
          const existing = await scoutingDB.getTeam(teamNum);

          if (!existing) {
            await scoutingDB.saveTeam({
              teamNumber: teamNum,
              teamName: `Team ${teamNum}`,
              pit: pitData,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            importedCount++;
          } else {
            if (existing.pit && JSON.stringify(existing.pit) === JSON.stringify(pitData)) {
              duplicateCount++;
            } else {
              existing.pit = { ...existing.pit, ...pitData };
              await scoutingDB.saveTeam(existing);
              importedCount++;
            }
          }
        } else if (recType === 'MATCH') {
          const matchRecord = recData as MatchScoutingRecord;
          const matchNumber = isCompact ? rec.mn : rec.matchNumber;
          const finalMatch: MatchScoutingRecord = {
            ...matchRecord,
            id: recId,
            teamNumber: teamNum,
            matchNumber: matchNumber || matchRecord.matchNumber || 1,
            timestamp: matchRecord.timestamp || Date.now(),
          };

          const existingMatches = await scoutingDB.getAllMatches();
          const existingMatch = existingMatches.find(
            (m: MatchScoutingRecord) => m.id === finalMatch.id || (m.matchNumber === finalMatch.matchNumber && m.teamNumber === finalMatch.teamNumber)
          );

          if (existingMatch) {
            if (JSON.stringify(existingMatch) === JSON.stringify(finalMatch)) {
              duplicateCount++;
            } else {
              await scoutingDB.saveMatch({
                ...existingMatch,
                ...finalMatch,
                id: existingMatch.id || finalMatch.id,
              });
              importedCount++;
            }
          } else {
            await scoutingDB.saveMatch(finalMatch);
            importedCount++;
          }
        }
      }

      let msg = '';
      if (importedCount > 0 && duplicateCount > 0) {
        msg = `Imported ${importedCount} record(s) (${duplicateCount} duplicate skipped)`;
      } else if (importedCount > 0) {
        msg = `Imported ${importedCount} record(s)`;
      } else {
        msg = `Already up to date (${duplicateCount} duplicate)`;
      }

      return {
        success: true,
        importedCount,
        duplicateCount,
        message: msg,
      };
    } catch (err: any) {
      return {
        success: false,
        importedCount: 0,
        duplicateCount: 0,
        message: err.message || 'Failed to parse Scout Data QR.',
      };
    }
  },
};
