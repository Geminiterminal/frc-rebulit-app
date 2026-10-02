/**
 * Robust IndexedDB client storage for FRC REBUILT Scouting
 * Fully offline-first, zero cloud dependencies.
 */

import { TeamProfile, MatchScoutingRecord, StrategyPlan, ScoutingDatabaseExport } from '../types/scouting';

let onSaveHook: ((type: 'team' | 'match' | 'strategy', data: any) => void) | null = null;
export function registerDBSaveHook(fn: (type: 'team' | 'match' | 'strategy', data: any) => void) {
  onSaveHook = fn;
}

const DB_NAME = 'frc_rebuilt_scouting_db';
const DB_VERSION = 2;

class ScoutingDB {
  private db: IDBDatabase | null = null;
  private isReadyPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  public init(): Promise<void> {
    if (this.isReadyPromise) return this.isReadyPromise;

    this.isReadyPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        console.warn('IndexedDB not supported, falling back to in-memory/localStorage');
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Teams store
        if (!db.objectStoreNames.contains('teams')) {
          db.createObjectStore('teams', { keyPath: 'teamNumber' });
        }

        // Matches store
        if (!db.objectStoreNames.contains('matches')) {
          const matchStore = db.createObjectStore('matches', { keyPath: 'id' });
          matchStore.createIndex('teamNumber', 'teamNumber', { unique: false });
          matchStore.createIndex('matchNumber', 'matchNumber', { unique: false });
        }

        // Strategy store
        if (!db.objectStoreNames.contains('strategies')) {
          db.createObjectStore('strategies', { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        resolve(); // resolve so app still operates with fallback
      };
    });

    return this.isReadyPromise;
  }

  private async getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore | null> {
    await this.init();
    if (!this.db) return null;
    try {
      const tx = this.db.transaction(storeName, mode);
      return tx.objectStore(storeName);
    } catch (e) {
      console.error(`Error getting object store ${storeName}:`, e);
      return null;
    }
  }

  // --- TEAMS ---
  async getTeam(teamNumber: number): Promise<TeamProfile | null> {
    await this.init();
    if (!this.db) {
      const local = localStorage.getItem(`team_${teamNumber}`);
      return local ? JSON.parse(local) : null;
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction('teams', 'readonly');
      const store = tx.objectStore('teams');
      const req = store.get(teamNumber);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async getAllTeams(): Promise<TeamProfile[]> {
    await this.init();
    if (!this.db) {
      const teams: TeamProfile[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('team_')) {
          teams.push(JSON.parse(localStorage.getItem(key)!));
        }
      }
      return teams.sort((a, b) => a.teamNumber - b.teamNumber);
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction('teams', 'readonly');
      const store = tx.objectStore('teams');
      const req = store.getAll();
      req.onsuccess = () => {
        const res: TeamProfile[] = req.result || [];
        resolve(res.sort((a, b) => a.teamNumber - b.teamNumber));
      };
      req.onerror = () => resolve([]);
    });
  }

  async saveTeam(team: TeamProfile): Promise<void> {
    await this.init();
    team.updatedAt = Date.now();
    if (!team.createdAt) team.createdAt = Date.now();

    onSaveHook?.('team', team);

    if (!this.db) {
      localStorage.setItem(`team_${team.teamNumber}`, JSON.stringify(team));
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('teams', 'readwrite');
      const store = tx.objectStore('teams');
      const req = store.put(team);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteTeam(teamNumber: number): Promise<void> {
    await this.init();
    if (!this.db) {
      localStorage.removeItem(`team_${teamNumber}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('teams', 'readwrite');
      const store = tx.objectStore('teams');
      const req = store.delete(teamNumber);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- MATCHES ---
  async saveMatch(record: MatchScoutingRecord): Promise<void> {
    await this.init();
    onSaveHook?.('match', record);

    if (!this.db) {
      localStorage.setItem(`match_${record.id}`, JSON.stringify(record));
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('matches', 'readwrite');
      const store = tx.objectStore('matches');
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllMatches(): Promise<MatchScoutingRecord[]> {
    await this.init();
    if (!this.db) {
      const matches: MatchScoutingRecord[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('match_')) {
          matches.push(JSON.parse(localStorage.getItem(key)!));
        }
      }
      return matches.sort((a, b) => b.timestamp - a.timestamp);
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction('matches', 'readonly');
      const store = tx.objectStore('matches');
      const req = store.getAll();
      req.onsuccess = () => {
        const list: MatchScoutingRecord[] = req.result || [];
        resolve(list.sort((a, b) => b.timestamp - a.timestamp));
      };
      req.onerror = () => resolve([]);
    });
  }

  async getMatch(id: string): Promise<MatchScoutingRecord | null> {
    await this.init();
    if (!this.db) {
      const val = localStorage.getItem(`match_${id}`);
      return val ? JSON.parse(val) : null;
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction('matches', 'readonly');
      const store = tx.objectStore('matches');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async getMatchesForTeam(teamNumber: number): Promise<MatchScoutingRecord[]> {
    const all = await this.getAllMatches();
    return all.filter((m) => m.teamNumber === teamNumber);
  }

  async deleteMatch(id: string): Promise<void> {
    await this.init();
    if (!this.db) {
      localStorage.removeItem(`match_${id}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('matches', 'readwrite');
      const store = tx.objectStore('matches');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- STRATEGY PLANS ---
  async saveStrategy(plan: StrategyPlan): Promise<void> {
    await this.init();
    onSaveHook?.('strategy', plan);

    if (!this.db) {
      localStorage.setItem(`strat_${plan.id}`, JSON.stringify(plan));
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('strategies', 'readwrite');
      const store = tx.objectStore('strategies');
      const req = store.put(plan);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllStrategies(): Promise<StrategyPlan[]> {
    await this.init();
    if (!this.db) {
      const plans: StrategyPlan[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('strat_')) {
          plans.push(JSON.parse(localStorage.getItem(key)!));
        }
      }
      return plans;
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction('strategies', 'readonly');
      const store = tx.objectStore('strategies');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async deleteStrategy(id: string): Promise<void> {
    await this.init();
    if (!this.db) {
      localStorage.removeItem(`strat_${id}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('strategies', 'readwrite');
      const store = tx.objectStore('strategies');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- SETTINGS ---
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    await this.init();
    if (!this.db) {
      const val = localStorage.getItem(`setting_${key}`);
      return val ? JSON.parse(val) : defaultValue;
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = () => resolve(defaultValue);
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await this.init();
    if (!this.db) {
      localStorage.setItem(`setting_${key}`, JSON.stringify(value));
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- BACKUP EXPORT & IMPORT ---
  async exportFullDatabase(): Promise<ScoutingDatabaseExport> {
    const teams = await this.getAllTeams();
    const matchRecords = await this.getAllMatches();
    const strategyPlans = await this.getAllStrategies();
    const eventCode = await this.getSetting<string>('eventCode', '2026REBUILT');

    return {
      version: 1,
      exportedAt: Date.now(),
      teams,
      matchRecords,
      strategyPlans,
      eventCode,
    };
  }

  async importDatabase(
    data: ScoutingDatabaseExport,
    mode: 'update' | 'keep' | 'replace'
  ): Promise<{ importedTeams: number; importedMatches: number; conflictCount: number }> {
    await this.init();
    let importedTeams = 0;
    let importedMatches = 0;
    let conflictCount = 0;

    if (mode === 'replace') {
      await this.clearAllData();
    }

    const existingTeams = await this.getAllTeams();
    const existingMap = new Map(existingTeams.map((t) => [t.teamNumber, t]));

    // Import teams
    for (const team of data.teams) {
      const exists = existingMap.has(team.teamNumber);
      if (exists) {
        conflictCount++;
        if (mode === 'keep') {
          continue; // skip
        }
      }
      await this.saveTeam(team);
      importedTeams++;
    }

    // Import match records
    for (const match of data.matchRecords) {
      await this.saveMatch(match);
      importedMatches++;
    }

    // Import strategy plans
    if (data.strategyPlans) {
      for (const strat of data.strategyPlans) {
        await this.saveStrategy(strat);
      }
    }

    return { importedTeams, importedMatches, conflictCount };
  }

  async clearAllData(): Promise<void> {
    await this.init();

    // Clear localStorage fallback keys
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('team_') || k.startsWith('match_') || k.startsWith('strat_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem('frc_has_cleared_data', 'true');
    }

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(['teams', 'matches', 'strategies'], 'readwrite');
        tx.objectStore('teams').clear();
        tx.objectStore('matches').clear();
        tx.objectStore('strategies').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        console.error('Error clearing object stores:', err);
        resolve();
      }
    });
  }

  // Seed sample data if database is empty - Disabled so app starts with clean slate
  async seedInitialDataIfEmpty(): Promise<boolean> {
    return false;
  }

  // Force seed sample competition data (Team 9751, 254, 1678)
  async seedSampleData(): Promise<boolean> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('frc_has_cleared_data');
    }

    // Seed Team 9751 (as requested by user)
    const team9751: TeamProfile = {
      teamNumber: 9751,
      teamName: 'Titan Robotics',
      organization: 'REBUILT High School',
      location: 'San Jose, CA',
      createdAt: Date.now() - 3600000 * 24,
      updatedAt: Date.now(),
      pit: {
        drivetrain: 'SWERVE',
        shooter: ['TURRET', 'PIVOTING'],
        hopperCapacity: 20,
        shootingAccuracy: '85–94%',
        shootingAreas: [
          { id: 'zone-1', x: 78, y: 32, label: 'Trench Shot', zoneType: 'trench' },
          { id: 'zone-2', x: 50, y: 38, label: 'Hub Key', zoneType: 'hub' },
          { id: 'zone-3', x: 22, y: 30, label: 'Bump Flank', zoneType: 'bump' },
        ],
        bumpTrench: 'BOTH',
        hasAutonomous: 'YES',
        autoRoutinesCount: '2',
        autoConsistency: 'VERY CONSISTENT',
        biggestIssues: ['MECHANICAL'],
        reliability: 'MOSTLY RELIABLE',
        notes: 'Very clean wiring. Swerve drive Mk4i with L2 gearing. Quick cycle shooter with beam-break indexer.',
        autoDrawings: [
          {
            id: 'auto-9751-1',
            name: '3-Ball Trench + Rendezvous',
            createdAt: Date.now() - 3600000 * 12,
            startPosition: { x: 78, y: 25, angle: 180, label: 'Trench Start' },
            paths: [
              {
                id: 'p1',
                color: '#3b82f6',
                width: 4,
                type: 'path',
                points: [
                  { x: 78, y: 25 },
                  { x: 78, y: 46 },
                  { x: 78, y: 52 },
                ],
                label: 'Intake 2 balls',
              },
              {
                id: 'p2',
                color: '#ef4444',
                width: 4,
                type: 'shoot',
                points: [
                  { x: 78, y: 52 },
                  { x: 50, y: 30 },
                ],
                label: 'Score in Blue Hub',
              },
            ],
            notes: 'Consistent 5 ball auto when alliance partners stay out of trench.',
          },
        ],
        photos: [],
        lastUpdated: Date.now(),
      },
    };

    // Also seed a couple realistic alliance partner reference teams
    const team254: TeamProfile = {
      teamNumber: 254,
      teamName: 'The Cheesy Poofs',
      createdAt: Date.now() - 3600000 * 20,
      updatedAt: Date.now(),
      pit: {
        drivetrain: 'SWERVE',
        shooter: ['TURRET'],
        hopperCapacity: 25,
        shootingAccuracy: '95%+',
        shootingAreas: [
          { id: 'z1', x: 50, y: 35, label: 'Hub Key', zoneType: 'hub' },
          { id: 'z2', x: 80, y: 35, label: 'Trench', zoneType: 'trench' },
          { id: 'z3', x: 50, y: 50, label: 'Center Field', zoneType: 'open' },
        ],
        bumpTrench: 'BOTH',
        hasAutonomous: 'YES',
        autoRoutinesCount: '4+',
        autoConsistency: 'VERY CONSISTENT',
        biggestIssues: ['NONE'],
        reliability: 'VERY RELIABLE',
        notes: 'Top tier vision auto-aiming turret. Rapid climb under 4 seconds.',
        autoDrawings: [],
        photos: [],
        lastUpdated: Date.now(),
      },
    };

    const team1678: TeamProfile = {
      teamNumber: 1678,
      teamName: 'Citrus Circuits',
      createdAt: Date.now() - 3600000 * 18,
      updatedAt: Date.now(),
      pit: {
        drivetrain: 'SWERVE',
        shooter: ['TURRET', 'PIVOTING'],
        hopperCapacity: 22,
        shootingAccuracy: '95%+',
        shootingAreas: [
          { id: 'z1', x: 50, y: 32, label: 'Protected Key', zoneType: 'hub' },
          { id: 'z2', x: 82, y: 40, label: 'Trench Alley', zoneType: 'trench' },
        ],
        bumpTrench: 'BOTH',
        hasAutonomous: 'YES',
        autoRoutinesCount: '4+',
        autoConsistency: 'VERY CONSISTENT',
        biggestIssues: ['NONE'],
        reliability: 'VERY RELIABLE',
        notes: 'Triple buddy climb mechanism tested in practice match.',
        autoDrawings: [],
        photos: [],
        lastUpdated: Date.now(),
      },
    };

    await this.saveTeam(team9751);
    await this.saveTeam(team254);
    await this.saveTeam(team1678);

    // Seed 1 realistic match record for 9751
    const match1: MatchScoutingRecord = {
      id: 'match-q1-9751',
      teamNumber: 9751,
      matchNumber: 1,
      matchType: 'Qualification',
      alliance: 'BLUE',
      scoutName: 'Lead Scout',
      timestamp: Date.now() - 3600000 * 4,
      preloadBalls: 3,
      startPosition: 'Right',
      autoMobility: true,
      autoHighScored: 4,
      autoLowScored: 0,
      autoMissed: 1,
      teleopHighScored: 18,
      teleopLowScored: 2,
      teleopMissed: 3,
      usedTrench: true,
      usedBump: false,
      defensePlayed: 'None',
      hangStatus: 'Level Climb',
      climbSpeed: 'Fast (<5s)',
      robotBroke: false,
      cards: 'None',
      overallRating: 5,
      notes: 'Awesome trench running speed. Fast cycles and reliable climb at the buzzer.',
    };

    await this.saveMatch(match1);
    return true;
  }
}

export const scoutingDB = new ScoutingDB();
