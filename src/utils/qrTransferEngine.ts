/**
 * QR Code Assignment & Scout-Data Transfer Engine
 * Handles 100% offline device-to-device QR code data transfer.
 *
 * Payloads use a compact wire format (short keys + short data field
 * aliases) to keep QR density low. Parsers accept both the compact
 * format and the legacy verbose format for backward compatibility.
 */

import { scoutingDB } from '../db/indexedDB';
import { scoutingAssignments } from '../db/scoutingAssignments';
import { MatchScoutingRecord, PitData } from '../types/scouting';

/** Short key aliases for scouting data fields (applied at any depth). */
const KEY_MAP: Record<string, string> = {
  // PitData
  drivetrain: 'dt',
  drivetrainOther: 'dto',
  shooter: 'sh',
  shooterOther: 'sho',
  hopperCapacity: 'hc',
  shootingAccuracy: 'sa',
  shootingAreas: 'saz',
  canShootAnywhere: 'csa',
  bumpTrench: 'bt',
  hasAutonomous: 'ha',
  autoRoutinesCount: 'arc',
  autoDrawings: 'ad',
  autoConsistency: 'ac',
  biggestIssues: 'bi',
  biggestIssueOther: 'bio',
  reliability: 'rl',
  scoutName: 'sn',
  lastUpdated: 'lu',
  // MatchScoutingRecord
  autoWorked: 'aw',
  autoFuelScored: 'af',
  teleopFuelScored: 'tf',
  fieldRoute: 'fr',
  playedDefense: 'pd',
  defenseEffectiveness: 'de',
  robotIssues: 'ri',
  whatHappenedNote: 'whn',
  quickNote: 'qn',
  impression: 'im',
  // Nested shapes (zone points, drawings, start positions)
  zoneType: 'zt',
  label: 'l',
  color: 'c',
  width: 'w',
  points: 'p',
  angle: 'a',
  startPosition: 'sp',
  paths: 'pa',
  name: 'n',
  createdAt: 'ca',
};

const REVERSE_KEY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k]),
);

function applyKeyMap(obj: any, map: Record<string, string>): any {
  if (Array.isArray(obj)) return obj.map((v) => applyKeyMap(v, map));
  if (obj !== null && typeof obj === 'object') {
    const out: any = {};
    for (const [key, value] of Object.entries(obj)) {
      out[map[key] ?? key] = applyKeyMap(value, map);
    }
    return out;
  }
  return obj;
}

export interface AssignmentPayload {
  type: 'ASSIGNMENT';
  scoutId: string;
  scoutRole: 'PIT_SCOUT' | 'MATCH_SCOUT';
  assignedTeams: number[];
  assignedMatches?: number[];
  timestamp: number;
}

export interface ScoutDataRecord {
  type: 'PIT' | 'MATCH';
  id: string;
  teamNumber: number;
  matchNumber?: number;
  data: PitData | MatchScoutingRecord;
}

export interface ScoutDataChunkPayload {
  type: 'SCOUT_DATA';
  scoutId: string;
  chunkIndex: number;
  totalChunks: number;
  records: ScoutDataRecord[];
  timestamp: number;
}

function cleanEmptyFields(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanEmptyFields).filter(v => v !== null && v !== undefined && v !== '');
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    let hasKeys = false;
    for (const [key, value] of Object.entries(obj)) {
      // Exclude binary/base64 heavy image properties from QR payloads
      if (key === 'thumbnailDataUrl' || key === 'photos' || key === 'dataUrl') {
        continue;
      }

      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'object' && Object.keys(value).length === 0) continue;

      // Downsample drawing points to keep QR coordinate string length tiny
      if (key === 'points' && Array.isArray(value)) {
        cleaned[key] = downsamplePoints(value);
        hasKeys = true;
        continue;
      }

      let child = cleanEmptyFields(value);
      if (child !== null && child !== undefined && child !== '') {
        // Strip out legacy/redundant fields from MatchScoutingRecord
        if (['autoHighScored', 'teleopHighScored', 'notes', 'hangStatus'].includes(key)) {
          continue;
        }

        // Round standard x/y coordinates to 1 decimal place to save characters
        if ((key === 'x' || key === 'y') && typeof child === 'number') {
          child = Math.round(child * 10) / 10;
        }
        cleaned[key] = child;
        hasKeys = true;
      }
    }
    return hasKeys ? cleaned : undefined;
  }
  return obj;
}

function downsamplePoints(points: any[]): any[] {
  if (!Array.isArray(points)) return [];
  const maxPoints = 15; // 15 coordinates is the sweet spot for smooth curve vectors and minimum storage
  if (points.length <= maxPoints) {
    return points.map(p => ({
      x: typeof p.x === 'number' ? Math.round(p.x * 10) / 10 : p.x,
      y: typeof p.y === 'number' ? Math.round(p.y * 10) / 10 : p.y
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
        y: typeof p.y === 'number' ? Math.round(p.y * 10) / 10 : p.y
      });
    }
  }
  return result;
}

/** Pack one record into the compact wire shape. */
function packRecord(rec: ScoutDataRecord): any {
  const packed: any = { t: rec.type, i: rec.id, tn: rec.teamNumber };
  if (rec.matchNumber !== undefined && rec.matchNumber !== null) packed.mn = rec.matchNumber;
  packed.d = applyKeyMap(rec.data ?? {}, KEY_MAP);
  return packed;
}

/** Unpack a wire record (compact or legacy verbose) back into canonical shape. */
function unpackRecord(rec: any): ScoutDataRecord | null {
  if (!rec || typeof rec !== 'object') return null;
  return {
    type: rec.t ?? rec.type,
    id: rec.i ?? rec.id ?? '',
    teamNumber: rec.tn ?? rec.teamNumber,
    matchNumber: rec.mn ?? rec.matchNumber,
    data: applyKeyMap(rec.d ?? rec.data ?? {}, REVERSE_KEY_MAP),
  };
}

export const qrTransferEngine = {
  /**
   * Generate Assignment QR Payload JSON string (compact wire format)
   */
  generateAssignmentPayload(
    scoutId: string,
    scoutRole: 'PIT_SCOUT' | 'MATCH_SCOUT',
    assignedTeams: number[],
    assignedMatches: number[] = []
  ): string {
    const payload: any = {
      v: 2,
      t: 'AS',
      s: scoutId,
      r: scoutRole,
      at: assignedTeams,
    };
    if (assignedMatches.length > 0) {
      payload.am = assignedMatches;
    }
    return JSON.stringify(payload);
  },

  /**
   * Parse Assignment QR code string and store on Scout device
   * (accepts compact and legacy verbose formats)
   */
  parseAssignmentPayload(qrString: string): { success: boolean; scoutId: string; teams: number[]; message: string } {
    try {
      const parsed = JSON.parse(qrString.trim());
      const scoutId = parsed.s ?? parsed.scoutId;
      const scoutRole = parsed.r ?? parsed.scoutRole;
      const assignedTeams = parsed.at ?? parsed.assignedTeams;
      if ((parsed.t !== 'AS' && parsed.type !== 'ASSIGNMENT') || !scoutId || !Array.isArray(assignedTeams)) {
        throw new Error('Invalid Assignment QR format.');
      }

      // Save Scout profile and assigned target teams
      scoutingAssignments.setProfile({
        name: scoutId,
        position: scoutRole,
        isSetupComplete: true,
      });

      // Save assigned teams list
      scoutingAssignments.assignTeamsToScout(scoutId, assignedTeams);

      return {
        success: true,
        scoutId,
        teams: assignedTeams,
        message: `Assigned ${assignedTeams.length} teams to ${scoutId}!`,
      };
    } catch (err: any) {
      return {
        success: false,
        scoutId: '',
        teams: [],
        message: err.message || 'Failed to parse assignment QR.',
      };
    }
  },

  /**
   * Generate a standard single-record SCOUT_DATA QR payload for PIT scouting
   */
  generateSinglePitQr(scoutId: string, teamNumber: number, pitData: PitData): string {
    const cleanedPit = cleanEmptyFields(pitData);
    const payload = {
      v: 2,
      t: 'SD',
      s: scoutId,
      r: [packRecord({ type: 'PIT', id: `pit-${teamNumber}`, teamNumber, data: cleanedPit || {} })],
    };
    return JSON.stringify(payload);
  },

  /**
   * Generate a standard single-record SCOUT_DATA QR payload for MATCH scouting
   */
  generateSingleMatchQr(scoutId: string, matchRecord: MatchScoutingRecord): string {
    // Ensure id exists
    const record = {
      ...matchRecord,
      id: matchRecord.id || `match-${matchRecord.matchNumber}-${matchRecord.teamNumber}`
    };
    // Forcefully remove legacy fields from the record before cleaning
    const { autoHighScored, teleopHighScored, notes, hangStatus, ...sanitizedRecord } = record as any;
    const cleanedMatch = cleanEmptyFields(sanitizedRecord);
    const payload = {
      v: 2,
      t: 'SD',
      s: scoutId,
      r: [packRecord({
        type: 'MATCH',
        id: sanitizedRecord.id,
        teamNumber: sanitizedRecord.teamNumber,
        matchNumber: sanitizedRecord.matchNumber,
        data: cleanedMatch || {},
      })],
    };
    return JSON.stringify(payload);
  },

  /**
   * Import Scout Data QR Code payload on Captain device with Duplicate Protection
   * (accepts compact and legacy verbose formats)
   */
  async importScoutDataQrPayload(qrString: string): Promise<{ success: boolean; importedCount: number; duplicateCount: number; message: string }> {
    try {
      const parsed = JSON.parse(qrString.trim());
      const rawRecords = parsed.r ?? parsed.records;
      if ((parsed.t !== 'SD' && parsed.type !== 'SCOUT_DATA') || !Array.isArray(rawRecords)) {
        throw new Error('Invalid Scout Data QR format.');
      }
      const records = rawRecords.map(unpackRecord).filter(Boolean) as ScoutDataRecord[];

      if (records.length === 0) {
        return {
          success: true,
          importedCount: 0,
          duplicateCount: 0,
          message: 'QR Code scanned (No records to import).',
        };
      }

      let importedCount = 0;
      let duplicateCount = 0;

      for (const rec of records) {
        if (rec.type === 'PIT') {
          const teamNum = rec.teamNumber;
          const pitData = rec.data as PitData;
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
            // Check if pit data is identical
            if (existing.pit && JSON.stringify(existing.pit) === JSON.stringify(pitData)) {
              duplicateCount++;
            } else {
              existing.pit = { ...existing.pit, ...pitData };
              await scoutingDB.saveTeam(existing);
              importedCount++;
            }
          }
        } else if (rec.type === 'MATCH') {
          const matchRecord = rec.data as MatchScoutingRecord;
          const matchId = rec.id || matchRecord.id;

          // Check if match record already exists in Captain's DB
          const existingMatches = await scoutingDB.getAllMatches();
          const existingMatch = existingMatches.find(
            (m: MatchScoutingRecord) => m.id === matchId || (m.matchNumber === matchRecord.matchNumber && m.teamNumber === matchRecord.teamNumber)
          );

          if (existingMatch) {
            // Overwrite/merge if incoming match contains different values (e.g. updated notes or scores)
            if (JSON.stringify(existingMatch) === JSON.stringify(matchRecord)) {
              duplicateCount++;
            } else {
              await scoutingDB.saveMatch({
                ...existingMatch,
                ...matchRecord,
                id: existingMatch.id || matchId,
              });
              importedCount++;
            }
          } else {
            await scoutingDB.saveMatch({
              ...matchRecord,
              id: matchId,
            });
            importedCount++;
          }
        }
      }

      let msg = '';
      if (importedCount > 0 && duplicateCount > 0) {
        msg = `✓ ${importedCount} record(s) imported (${duplicateCount} duplicate skipped)`;
      } else if (importedCount > 0) {
        msg = `✓ ${importedCount} record(s) imported`;
      } else {
        msg = `✓ Already imported (${duplicateCount} duplicate records)`;
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
