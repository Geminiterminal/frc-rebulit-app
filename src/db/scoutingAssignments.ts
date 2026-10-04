/**
 * Scouting Hierarchy, Roles & Target List Management
 * Pure offline role-based assignments for Pit Scouts and Match Scouts.
 */

import { scoutingDB } from './indexedDB';

export type ScoutPosition = 'LEAD_SCOUT' | 'PIT_SCOUT' | 'MATCH_SCOUT' | 'STRATEGIST' | 'DRIVE_TEAM';

export interface PositionMeta {
  id: ScoutPosition;
  label: string;
  badge: string;
  icon: string;
  description: string;
  isPrivileged?: boolean;
}

export const SCOUT_POSITIONS: PositionMeta[] = [
  {
    id: 'LEAD_SCOUT',
    label: 'Lead Scout / Admin',
    badge: '👑 Lead Scout',
    icon: 'Crown',
    description: 'Assigns team and match numbers to scouts, creates sync rooms, and coordinates scouting operations.',
    isPrivileged: true,
  },
  {
    id: 'PIT_SCOUT',
    label: 'Pit Scout',
    badge: '🎯 Pit Scout',
    icon: 'Target',
    description: 'Inspects robots in the pit, takes robot photos, and documents drivetrain, dimensions & mechanisms.',
  },
  {
    id: 'MATCH_SCOUT',
    label: 'Match Scout',
    badge: '⚡ Match Scout',
    icon: 'Zap',
    description: 'Scouts real-time qualification matches, tracking autonomous scoring, teleop cycles, and endgame.',
  },
  {
    id: 'STRATEGIST',
    label: 'Strategist / Drive Coach',
    badge: '📊 Strategist',
    icon: 'BarChart3',
    description: 'Reviews team radars, runs match simulations, and formulates playoff alliance picklists.',
  },
  {
    id: 'DRIVE_TEAM',
    label: 'Pit Crew / Drive Team',
    badge: '🛠️ Drive Team',
    icon: 'Wrench',
    description: 'Quick reference for opposing alliance robot specs, match notes, and field prep.',
  },
];

export interface ScoutProfile {
  name: string;
  position: ScoutPosition;
  isSetupComplete: boolean;
  teamNumber?: number;
}

export interface MatchScoutTask {
  matchNumber: number;
  teamNumber: number;
}
export type MatchTarget = MatchScoutTask;

export interface ScoutAssignment {
  scoutName: string;
  assignedTeams: number[];
  assignedMatches?: number[];
  matchNumber?: number;
  matchTargets?: MatchTarget[];
  matchTasks?: MatchScoutTask[];
  role?: 'PIT_SCOUT' | 'MATCH_SCOUT';
  notes?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'frc_scout_assignments';
const MY_TEAMS_KEY = 'frc_my_target_teams';
const MY_MATCH_TASKS_KEY = 'frc_my_match_tasks';
const PROFILE_KEY = 'frc_scout_profile';

export const scoutingAssignments = {
  // Get current active profile
  getProfile(): ScoutProfile {
    if (typeof localStorage === 'undefined') {
      return { name: '', position: 'PIT_SCOUT', isSetupComplete: false };
    }
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          name: parsed.name || '',
          position: parsed.position || 'PIT_SCOUT',
          isSetupComplete: Boolean(parsed.isSetupComplete),
          teamNumber: parsed.teamNumber || undefined,
        };
      }
      return { name: '', position: 'PIT_SCOUT', isSetupComplete: false };
    } catch {
      return { name: '', position: 'PIT_SCOUT', isSetupComplete: false };
    }
  },

  // Save active profile
  setProfile(profile: Partial<ScoutProfile>): ScoutProfile {
    if (typeof localStorage === 'undefined') {
      return { name: '', position: 'PIT_SCOUT', isSetupComplete: false };
    }
    try {
      const current = this.getProfile();
      const updated: ScoutProfile = {
        ...current,
        ...profile,
        name: profile.name !== undefined ? profile.name.trim() : current.name,
        position: profile.position || current.position || 'PIT_SCOUT',
        isSetupComplete: profile.isSetupComplete !== undefined ? profile.isSetupComplete : true,
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to set profile:', e);
      return this.getProfile();
    }
  },

  // Check if active user holds the Lead Scout / Admin position
  isLeadScout(): boolean {
    const profile = this.getProfile();
    return profile.position === 'LEAD_SCOUT';
  },

  // Get all scout assignments (created by Captain)
  getAllAssignments(): ScoutAssignment[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Set all scout assignments
  setAllAssignments(list: ScoutAssignment[]): void {
    if (typeof localStorage === 'undefined' || !Array.isArray(list)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save assignments:', e);
    }
  },

  // Assign teams & match tasks to a specific scout
  assignScout(
    scoutName: string,
    role: 'PIT_SCOUT' | 'MATCH_SCOUT',
    assignedTeams: number[],
    matchTasks: MatchScoutTask[] = [],
    notes: string = ''
  ): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const all = this.getAllAssignments();
      const filtered = all.filter((a) => a.scoutName.trim().toLowerCase() !== scoutName.trim().toLowerCase());

      const cleanTeams = Array.from(new Set(assignedTeams.filter((t) => Number.isInteger(t) && t > 0))).sort((a, b) => a - b);
      const cleanTasks = matchTasks.filter((t) => t.matchNumber > 0 && t.teamNumber > 0);

      filtered.push({
        scoutName: scoutName.trim(),
        role,
        assignedTeams: role === 'MATCH_SCOUT' && cleanTasks.length > 0 ? Array.from(new Set(cleanTasks.map((t) => t.teamNumber))) : cleanTeams,
        matchTasks: role === 'MATCH_SCOUT' ? cleanTasks : undefined,
        notes,
        updatedAt: Date.now(),
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to assign scout:', e);
    }
  },

  // Legacy helper
  assignTeamsToScout(
    scoutName: string, 
    teams: number[], 
    role: 'PIT_SCOUT' | 'MATCH_SCOUT' = 'PIT_SCOUT', 
    notes: string = '',
    matchTargets?: MatchTarget[]
  ): void {
    const matchTasks = matchTargets && matchTargets.length > 0 ? matchTargets : [];
    this.assignScout(scoutName, role, teams, matchTasks, notes);
  },

  // Delete assignment for a scout
  deleteAssignment(scoutName: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const all = this.getAllAssignments();
      const filtered = all.filter((a) => a.scoutName.trim().toLowerCase() !== scoutName.trim().toLowerCase());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to delete assignment:', e);
    }
  },

  // Get active scout's match tasks
  getMyMatchTasks(): MatchScoutTask[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const myScout = this.getProfile().name.trim().toLowerCase();
      const all = this.getAllAssignments();
      const matched = all.find((a) => a.scoutName.trim().toLowerCase() === myScout);
      if (matched && matched.matchTasks && matched.matchTasks.length > 0) {
        return matched.matchTasks;
      }
      if (matched && matched.matchTargets && matched.matchTargets.length > 0) {
        return matched.matchTargets;
      }
      const raw = localStorage.getItem(MY_MATCH_TASKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getMyMatchTargets(): MatchTarget[] {
    return this.getMyMatchTasks();
  },

  setMyMatchTasks(tasks: MatchScoutTask[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(MY_MATCH_TASKS_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to set my match tasks:', e);
    }
  },

  setMyMatchTargets(targets: MatchTarget[]): void {
    this.setMyMatchTasks(targets);
  },

  // Get target team numbers for the current scout
  getMyTargetTeams(): number[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const myScout = this.getProfile().name.trim().toLowerCase();
      const all = this.getAllAssignments();
      const matched = all.find((a) => a.scoutName.trim().toLowerCase() === myScout);
      if (matched && matched.assignedTeams && matched.assignedTeams.length > 0) {
        return matched.assignedTeams;
      }
      const raw = localStorage.getItem(MY_TEAMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Set target team numbers for current scout
  setMyTargetTeams(teams: number[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const clean = Array.from(new Set(teams.filter((t) => Number.isInteger(t) && t > 0)));
      localStorage.setItem(MY_TEAMS_KEY, JSON.stringify(clean));
    } catch (e) {
      console.error('Failed to set target teams:', e);
    }
  },

  // Check completion status for a team
  async getTeamStatus(teamNumber: number): Promise<{ isPitScouted: boolean; matchCount: number }> {
    try {
      const profile = await scoutingDB.getTeam(teamNumber);
      const matches = await scoutingDB.getMatchesForTeam(teamNumber);
      const isPitScouted = Boolean(
        profile && (
          profile.pit?.drivetrain || 
          profile.pit?.shooter?.length || 
          profile.pit?.notes || 
          profile.pit?.photos?.length ||
          profile.pit?.lastUpdated
        )
      );
      return { isPitScouted, matchCount: matches.length };
    } catch {
      return { isPitScouted: false, matchCount: 0 };
    }
  },

  // Check completion status for a specific match + team
  async getMatchTaskStatus(matchNumber: number, teamNumber: number): Promise<boolean> {
    try {
      const matches = await scoutingDB.getMatchesForTeam(teamNumber);
      return matches.some((m) => m.matchNumber === matchNumber);
    } catch {
      return false;
    }
  },

  addTeamToTarget(teamNumber: number): void {
    const current = this.getMyTargetTeams();
    if (!current.includes(teamNumber)) {
      this.setMyTargetTeams([...current, teamNumber]);
    }
  },

  removeTeamFromTarget(teamNumber: number): void {
    const current = this.getMyTargetTeams();
    this.setMyTargetTeams(current.filter((t) => t !== teamNumber));
  },

  addMatchTask(matchNumber: number, teamNumber: number): void {
    const current = this.getMyMatchTasks();
    const exists = current.some((t) => t.matchNumber === matchNumber && t.teamNumber === teamNumber);
    if (!exists) {
      this.setMyMatchTasks([...current, { matchNumber, teamNumber }]);
      this.addTeamToTarget(teamNumber);
    }
  },
};
