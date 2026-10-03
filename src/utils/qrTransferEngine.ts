/**
 * QR Code Assignment & Scout-Data Transfer Engine
 * Handles 100% offline device-to-device QR code data transfer with chunking and duplicate protection.
 */

import { scoutingDB } from '../db/indexedDB';
import { scoutingAssignments } from '../db/scoutingAssignments';
import { MatchScoutingRecord, PitData } from '../types/scouting';

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

const MAX_CHUNK_CHAR_LIMIT = 1100; // Optimal density for phone screen QR scanning

export const qrTransferEngine = {
  /**
   * Generate Assignment QR Payload JSON string
   */
  generateAssignmentPayload(
    scoutId: string,
    scoutRole: 'PIT_SCOUT' | 'MATCH_SCOUT',
    assignedTeams: number[],
    assignedMatches: number[] = []
  ): string {
    const payload: AssignmentPayload = {
      type: 'ASSIGNMENT',
      scoutId,
      scoutRole,
      assignedTeams,
      assignedMatches,
      timestamp: Date.now(),
    };
    return JSON.stringify(payload);
  },

  /**
   * Parse Assignment QR code string and store on Scout device
   */
  parseAssignmentPayload(qrString: string): { success: boolean; scoutId: string; teams: number[]; message: string } {
    try {
      const parsed: AssignmentPayload = JSON.parse(qrString.trim());
      if (parsed.type !== 'ASSIGNMENT' || !parsed.scoutId || !Array.isArray(parsed.assignedTeams)) {
        throw new Error('Invalid Assignment QR format.');
      }

      // Save Scout profile and assigned target teams
      scoutingAssignments.setProfile({
        name: parsed.scoutId,
        position: parsed.scoutRole,
        isSetupComplete: true,
      });

      // Save assigned teams list
      scoutingAssignments.assignTeamsToScout(parsed.scoutId, parsed.assignedTeams);

      return {
        success: true,
        scoutId: parsed.scoutId,
        teams: parsed.assignedTeams,
        message: `Assigned ${parsed.assignedTeams.length} teams to ${parsed.scoutId}!`,
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
   * Collect local scouting records and split into chunked QR payloads
   */
  async generateScoutDataQrChunks(scoutId: string): Promise<string[]> {
    const allTeams = await scoutingDB.getAllTeams();
    const allMatches = await scoutingDB.getAllMatchRecords();

    const records: ScoutDataRecord[] = [];

    // Collect Pit Scouted teams
    for (const team of allTeams) {
      if (team.pit && Object.keys(team.pit).length > 0) {
        records.push({
          type: 'PIT',
          id: `pit-${team.teamNumber}`,
          teamNumber: team.teamNumber,
          data: team.pit,
        });
      }
    }

    // Collect Match Records
    for (const match of allMatches) {
      records.push({
        type: 'MATCH',
        id: match.id || `match-${match.matchNumber}-${match.teamNumber}`,
        teamNumber: match.teamNumber,
        matchNumber: match.matchNumber,
        data: match,
      });
    }

    if (records.length === 0) {
      // Empty payload
      const emptyPayload: ScoutDataChunkPayload = {
        type: 'SCOUT_DATA',
        scoutId,
        chunkIndex: 0,
        totalChunks: 1,
        records: [],
        timestamp: Date.now(),
      };
      return [JSON.stringify(emptyPayload)];
    }

    // Chunk records if payload size exceeds QR density limit
    const chunks: ScoutDataRecord[][] = [];
    let currentChunk: ScoutDataRecord[] = [];
    let currentSize = 0;

    for (const record of records) {
      const recordSize = JSON.stringify(record).length;
      if (currentChunk.length > 0 && currentSize + recordSize > MAX_CHUNK_CHAR_LIMIT) {
        chunks.push(currentChunk);
        currentChunk = [record];
        currentSize = recordSize;
      } else {
        currentChunk.push(record);
        currentSize += recordSize;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    const totalChunks = chunks.length;
    return chunks.map((chunkRecords, idx) => {
      const payload: ScoutDataChunkPayload = {
        type: 'SCOUT_DATA',
        scoutId,
        chunkIndex: idx,
        totalChunks,
        records: chunkRecords,
        timestamp: Date.now(),
      };
      return JSON.stringify(payload);
    });
  },

  /**
   * Import Scout Data QR Code payload on Captain device with Duplicate Protection
   */
  async importScoutDataQrPayload(qrString: string): Promise<{ success: boolean; importedCount: number; duplicateCount: number; message: string }> {
    try {
      const parsed: ScoutDataChunkPayload = JSON.parse(qrString.trim());
      if (parsed.type !== 'SCOUT_DATA' || !Array.isArray(parsed.records)) {
        throw new Error('Invalid Scout Data QR format.');
      }

      if (parsed.records.length === 0) {
        return {
          success: true,
          importedCount: 0,
          duplicateCount: 0,
          message: 'QR Code scanned (No records to import).',
        };
      }

      let importedCount = 0;
      let duplicateCount = 0;

      for (const rec of parsed.records) {
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
          const isDuplicate = existingMatches.some(
            (m: MatchScoutingRecord) => m.id === matchId || (m.matchNumber === matchRecord.matchNumber && m.teamNumber === matchRecord.teamNumber)
          );

          if (isDuplicate) {
            duplicateCount++;
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
