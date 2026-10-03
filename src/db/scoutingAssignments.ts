/**
 * Scouting Hierarchy, Roles & Target List Management
 * Role-based permissions: Lead Scout can assign teams to scouts and create rooms.
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
    description: 'Assigns team numbers to scouts, creates sync rooms, and coordinates scouting operations.',
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

export interface ScoutAssignment {
  scoutName: string;
  assignedTeams: number[];
  notes?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'frc_scout_assignments';
const MY_TEAMS_KEY = 'frc_my_target_teams';
const PROFILE_KEY = 'frc_scout_profile';

export const scoutingAssignments = {
  // Get current active profile
  getProfile(): ScoutProfile {
    if (typeof localStorage === 'undefined') {
      return { name: 'Scout', position: 'PIT_SCOUT', isSetupComplete: false };
    }
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          name: parsed.name || localStorage.getItem('frc_scout_name') || 'Scout',
          position: parsed.position || 'PIT_SCOUT',
          isSetupComplete: Boolean(parsed.isSetupComplete),
          teamNumber: parsed.teamNumber || 9751,
        };
      }
      // Fallback
      const legacyName = localStorage.getItem('frc_scout_name');
      const isKawser = legacyName && legacyName.trim().toLowerCase() === 'kawser';
      return {
        name: legacyName && legacyName.trim() ? legacyName.trim() : 'Scout',
        position: isKawser ? 'LEAD_SCOUT' : 'PIT_SCOUT',
        isSetupComplete: Boolean(legacyName),
        teamNumber: 9751,
      };
    } catch {
      return { name: 'Scout', position: 'PIT_SCOUT', isSetupComplete: false };
    }
  },

  // Save active profile
  setProfile(profile: Partial<ScoutProfile>): ScoutProfile {
    if (typeof localStorage === 'undefined') {
      return { name: 'Scout', position: 'PIT_SCOUT', isSetupComplete: false };
    }
    try {
      const current = this.getProfile();
      const updated: ScoutProfile = {
        ...current,
        ...profile,
        name: (profile.name !== undefined ? profile.name : current.name).trim() || 'Scout',
        position: profile.position || current.position || 'PIT_SCOUT',
        isSetupComplete: profile.isSetupComplete !== undefined ? profile.isSetupComplete : true,
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      localStorage.setItem('frc_scout_name', updated.name);
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

  // Get current active scout name
  getScoutName(): string {
    return this.getProfile().name;
  },

  // Get current position metadata
  getPositionMeta(): PositionMeta {
    const pos = this.getProfile().position;
    return SCOUT_POSITIONS.find((p) => p.id === pos) || SCOUT_POSITIONS[1];
  },

  // Get all scout assignments
  getAllAssignments(): ScoutAssignment[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Set all scout assignments (from Cloud / P2P sync)
  setAllAssignments(list: ScoutAssignment[]): void {
    if (typeof localStorage === 'undefined' || !Array.isArray(list)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save assignments:', e);
    }
  },

  // Get target team numbers for the current scout
  getMyTargetTeams(): number[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const myScout = this.getScoutName().trim().toLowerCase();
      // First check specific assignment
      const all = this.getAllAssignments();
      const matched = all.find((a) => a.scoutName.trim().toLowerCase() === myScout);
      if (matched && matched.assignedTeams.length > 0) {
        return matched.assignedTeams;
      }
      // Fallback to local custom target list
      const raw = localStorage.getItem(MY_TEAMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Set target team numbers for the current scout
  setMyTargetTeams(teams: number[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const clean = Array.from(new Set(teams.filter((t) => Number.isInteger(t) && t > 0)));
      localStorage.setItem(MY_TEAMS_KEY, JSON.stringify(clean));

      // Also sync to all assignments list
      const scoutName = this.getScoutName();
      this.assignTeamsToScout(scoutName, clean);
    } catch (e) {
      console.error('Failed to set target teams:', e);
    }
  },

  // Assign team numbers to a specific scout (Lead Scout or custom)
  assignTeamsToScout(scoutName: string, teams: number[], notes?: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const clean = Array.from(new Set(teams.filter((t) => Number.isInteger(t) && t > 0))).sort((a, b) => a - b);
      const all = this.getAllAssignments();
      const filtered = all.filter((a) => a.scoutName.trim().toLowerCase() !== scoutName.trim().toLowerCase());
      
      filtered.push({
        scoutName: scoutName.trim(),
        assignedTeams: clean,
        notes: notes || '',
        updatedAt: Date.now(),
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to assign teams:', e);
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

  // Quick helper to add a team to target list
  addTeamToTarget(teamNumber: number): void {
    const current = this.getMyTargetTeams();
    if (!current.includes(teamNumber)) {
      this.setMyTargetTeams([...current, teamNumber]);
    }
  },

  // Quick helper to remove a team from target list
  removeTeamFromTarget(teamNumber: number): void {
    const current = this.getMyTargetTeams();
    this.setMyTargetTeams(current.filter((t) => t !== teamNumber));
  }
};
