/**
 * Optimized QR Code Assignment & Scout-Data Transfer Engine
 * Compact payload encoding for instant, ultra-fast camera scanning without bloat.
 */

import { scoutingDB } from '../db/indexedDB';
import { scoutingAssignments, MatchScoutTask, MatchTarget } from '../db/scoutingAssignments';
import { MatchScoutingRecord, PitData, FieldRouteType, DefenseEffectivenessType, RobotIssuesType } from '../types/scouting';

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

      // Handle assignments based on role
      if (scoutRole === 'MATCH_SCOUT') {
        scoutingAssignments.setMyMatchTasks(mergedMatchTasks);
        scoutingAssignments.assignScout(scoutId, scoutRole, [], mergedMatchTasks);
      } else {
        const mergedTargetTeams = Array.from(
          new Set([...existingTargetTeams, ...assignedTeams])
        ).filter((t) => Number.isInteger(t) && t > 0);

        scoutingAssignments.setMyTargetTeams(mergedTargetTeams);
        scoutingAssignments.assignScout(scoutId, scoutRole, mergedTargetTeams, []);
      }

      const newMatchCount = matchTasks.length;
      const newPitCount = assignedTeams.length;
      const totalMatchTasks = mergedMatchTasks.length;

      let summaryText = '';
      if (scoutRole === 'MATCH_SCOUT') {
        summaryText = `Loaded ${newMatchCount} match task(s) (Total: ${totalMatchTasks} match tasks)`;
      } else {
        summaryText = `Loaded ${newPitCount} pit team(s)`;
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
    const compactPit: any = {
      dt: pitData.drivetrain,
      dto: pitData.drivetrainOther,
      sh: pitData.shooter,
      sho: pitData.shooterOther,
      hc: pitData.hopperCapacity,
      sa: pitData.shootingAccuracy,
      sz: pitData.shootingAreas,
      ca: pitData.canShootAnywhere,
      bt: pitData.bumpTrench,
      ha: pitData.hasAutonomous,
      arc: pitData.autoRoutinesCount,
      ac: pitData.autoConsistency,
      bi: pitData.biggestIssues,
      bio: pitData.biggestIssueOther,
      re: pitData.reliability,
      no: pitData.notes,
      sn: pitData.scoutName || scoutId,
      lu: pitData.lastUpdated || Date.now(),
    };

    const cleanedPit = cleanEmptyFields(compactPit);
    const payload = {
      t: 'SD',
      s: scoutId,
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
    const rec = {
      al: matchRecord.alliance === 'red' ? 'R' : matchRecord.alliance === 'blue' ? 'B' : undefined,
      aw: matchRecord.autoWorked ? 1 : 0,
      af: matchRecord.autoFuelScored || matchRecord.autoHighScored || 0,
      tf: matchRecord.teleopFuelScored || matchRecord.teleopHighScored || 0,
      fr: matchRecord.fieldRoute === 'BUMP' ? 'B' : matchRecord.fieldRoute === 'TRENCH' ? 'T' : matchRecord.fieldRoute === 'BOTH' ? '2' : 'N',
      pd: matchRecord.playedDefense ? 1 : 0,
      de: matchRecord.defenseEffectiveness === 'LOW' ? 'L' : matchRecord.defenseEffectiveness === 'HIGH' ? 'H' : matchRecord.defenseEffectiveness === 'MEDIUM' ? 'M' : undefined,
      ri: matchRecord.robotIssues === 'MINOR' ? 'm' : matchRecord.robotIssues === 'MAJOR' ? 'M' : matchRecord.robotIssues === 'DISABLED' ? 'D' : 'N',
      wn: matchRecord.whatHappenedNote || undefined,
      qn: matchRecord.quickNote || matchRecord.notes || undefined,
      im: matchRecord.impression || undefined,
    };
    const cleanedMatch = cleanEmptyFields(rec);
    const payload = {
      t: 'SD',
      s: scoutId,
      r: [{
        t: 'M',
        id: matchRecord.id || `match-m${matchRecord.matchNumber}-t${matchRecord.teamNumber}`,
        tn: matchRecord.teamNumber,
        mn: matchRecord.matchNumber,
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

      // If Captain scanned an Assignment QR code in Data Scanner modal
      if (parsed.t === 'A' || parsed.type === 'ASSIGNMENT') {
        const result = this.parseAssignmentPayload(qrString);
        return {
          success: result.success,
          importedCount: result.success ? 1 : 0,
          duplicateCount: 0,
          message: result.message,
        };
      }

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
        const teamNum = isCompact ? (rec.tn || rec.teamNumber) : rec.teamNumber;
        const recData = isCompact ? rec.d : rec.data;
        const recId = rec.id || `${recType}-${teamNum}`;

        if (recType === 'PIT') {
          const d = recData || {};
          const drivetrain = d.dt || d.drivetrain;
          const drivetrainOther = d.dto || d.drivetrainOther;
          const shooter = d.sh || d.shooter;
          const shooterOther = d.sho || d.shooterOther;
          const hopperCapacity = d.hc !== undefined ? Number(d.hc) : (d.hopperCapacity !== undefined ? Number(d.hopperCapacity) : undefined);
          const shootingAccuracy = d.sa || d.shootingAccuracy;
          const shootingAreas = d.sz || d.shootingAreas;
          const canShootAnywhere = d.ca || d.canShootAnywhere;
          const bumpTrench = d.bt || d.bumpTrench;
          const hasAutonomous = d.ha || d.hasAutonomous;
          const autoRoutinesCount = d.arc || d.autoRoutinesCount;
          const autoConsistency = d.ac || d.autoConsistency;
          const biggestIssues = d.bi || d.biggestIssues;
          const biggestIssueOther = d.bio || d.biggestIssueOther;
          const reliability = d.re || d.reliability;
          const notes = d.no || d.notes;
          const scoutName = d.sn || d.scoutName || parsed.s || 'Scout';
          const lastUpdated = d.lu || d.lastUpdated || rec.ts || Date.now();

          const decodedPit: PitData = {
            drivetrain,
            drivetrainOther,
            shooter,
            shooterOther,
            hopperCapacity,
            shootingAccuracy,
            shootingAreas,
            canShootAnywhere,
            bumpTrench,
            hasAutonomous,
            autoRoutinesCount,
            autoConsistency,
            biggestIssues,
            biggestIssueOther,
            reliability,
            notes,
            scoutName,
            lastUpdated,
          };

          const existing = await scoutingDB.getTeam(teamNum);

          if (!existing) {
            await scoutingDB.saveTeam({
              teamNumber: teamNum,
              teamName: `Team ${teamNum}`,
              pit: decodedPit,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            importedCount++;
          } else {
            if (existing.pit && JSON.stringify(existing.pit) === JSON.stringify(decodedPit)) {
              duplicateCount++;
            } else {
              existing.pit = { ...existing.pit, ...decodedPit };
              await scoutingDB.saveTeam(existing);
              importedCount++;
            }
          }
        } else if (recType === 'MATCH') {
          const d = recData || {};
          const matchNumber = isCompact ? (rec.mn || d.matchNumber || d.mn) : (rec.matchNumber || d.matchNumber);
          const autoWorked = d.aw !== undefined ? (d.aw === 1 || d.aw === true) : Boolean(d.autoWorked);
          const autoFuelScored = d.af !== undefined ? Number(d.af) : Number(d.autoFuelScored || d.autoHighScored || 0);
          const teleopFuelScored = d.tf !== undefined ? Number(d.tf) : Number(d.teleopFuelScored || d.teleopHighScored || 0);

          let fieldRoute: FieldRouteType = 'NEITHER';
          if (d.fr === 'B' || d.fieldRoute === 'BUMP') fieldRoute = 'BUMP';
          else if (d.fr === 'T' || d.fieldRoute === 'TRENCH') fieldRoute = 'TRENCH';
          else if (d.fr === '2' || d.fr === 'BOTH' || d.fieldRoute === 'BOTH') fieldRoute = 'BOTH';

          const playedDefense = d.pd !== undefined ? (d.pd === 1 || d.pd === true) : Boolean(d.playedDefense);

          let defenseEffectiveness: DefenseEffectivenessType | undefined = undefined;
          if (d.de === 'L' || d.defenseEffectiveness === 'LOW') defenseEffectiveness = 'LOW';
          else if (d.de === 'H' || d.defenseEffectiveness === 'HIGH') defenseEffectiveness = 'HIGH';
          else if (d.de === 'M' || d.defenseEffectiveness === 'MEDIUM') defenseEffectiveness = 'MEDIUM';

          let robotIssues: RobotIssuesType = 'NONE';
          if (d.ri === 'm' || d.robotIssues === 'MINOR') robotIssues = 'MINOR';
          else if (d.ri === 'M' || d.robotIssues === 'MAJOR') robotIssues = 'MAJOR';
          else if (d.ri === 'D' || d.robotIssues === 'DISABLED') robotIssues = 'DISABLED';

          let alliance: 'red' | 'blue' | undefined = undefined;
          if (d.al === 'R' || d.alliance === 'red') alliance = 'red';
          else if (d.al === 'B' || d.alliance === 'blue') alliance = 'blue';

          const matchId = recId || rec.id || d.id || `match-m${matchNumber || 1}-t${teamNum}-${Date.now()}`;

          const finalMatch: MatchScoutingRecord = {
            id: matchId,
            teamNumber: teamNum,
            matchNumber: matchNumber || 1,
            alliance,
            timestamp: rec.ts || d.timestamp || Date.now(),
            autoWorked,
            autoFuelScored,
            teleopFuelScored,
            fieldRoute,
            playedDefense,
            defenseEffectiveness,
            robotIssues,
            whatHappenedNote: d.wn || d.whatHappenedNote || undefined,
            quickNote: d.qn || d.quickNote || d.notes || undefined,
            impression: d.im || d.impression || undefined,
            autoHighScored: autoFuelScored,
            teleopHighScored: teleopFuelScored,
            notes: d.qn || d.quickNote || d.notes || undefined,
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

          // Ensure team profile exists
          const existingTeam = await scoutingDB.getTeam(teamNum);
          if (!existingTeam) {
            await scoutingDB.saveTeam({
              teamNumber: teamNum,
              teamName: `Team ${teamNum}`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
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
