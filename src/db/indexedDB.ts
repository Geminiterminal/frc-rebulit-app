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
      try {
        localStorage.setItem(`team_${team.teamNumber}`, JSON.stringify(team));
      } catch {
        // Safe quota catch
      }
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('teams', 'readwrite');
        const store = tx.objectStore('teams');
        const req = store.put(team);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async saveTeamsBatch(teams: TeamProfile[], notifyHook: boolean = false): Promise<void> {
    await this.init();
    const now = Date.now();
    teams.forEach((t) => {
      t.updatedAt = now;
      if (!t.createdAt) t.createdAt = now;
      if (notifyHook) {
        onSaveHook?.('team', t);
      }
    });

    if (!this.db) {
      try {
        teams.forEach((t) => localStorage.setItem(`team_${t.teamNumber}`, JSON.stringify(t)));
      } catch {}
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('teams', 'readwrite');
        const store = tx.objectStore('teams');
        teams.forEach((t) => store.put(t));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async deleteTeam(teamNumber: number): Promise<void> {
    await this.init();
    if (!this.db) {
      try {
        localStorage.removeItem(`team_${teamNumber}`);
      } catch {}
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('teams', 'readwrite');
        const store = tx.objectStore('teams');
        const req = store.delete(teamNumber);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // --- MATCHES ---
  async saveMatch(record: MatchScoutingRecord): Promise<void> {
    await this.init();
    onSaveHook?.('match', record);

    if (!this.db) {
      try {
        localStorage.setItem(`match_${record.id}`, JSON.stringify(record));
      } catch {}
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('matches', 'readwrite');
        const store = tx.objectStore('matches');
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
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
      try {
        localStorage.removeItem(`match_${id}`);
      } catch {}
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('matches', 'readwrite');
        const store = tx.objectStore('matches');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // --- STRATEGY PLANS ---
  async saveStrategy(plan: StrategyPlan): Promise<void> {
    await this.init();
    onSaveHook?.('strategy', plan);

    if (!this.db) {
      try {
        localStorage.setItem(`strat_${plan.id}`, JSON.stringify(plan));
      } catch {}
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('strategies', 'readwrite');
        const store = tx.objectStore('strategies');
        const req = store.put(plan);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async getAllStrategies(): Promise<StrategyPlan[]> {
    await this.init();
    if (!this.db) {
      const plans: StrategyPlan[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('strat_')) {
          try {
            plans.push(JSON.parse(localStorage.getItem(key)!));
          } catch {}
        }
      }
      return plans;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('strategies', 'readonly');
        const store = tx.objectStore('strategies');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async deleteStrategy(id: string): Promise<void> {
    await this.init();
    if (!this.db) {
      try {
        localStorage.removeItem(`strat_${id}`);
      } catch {}
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('strategies', 'readwrite');
        const store = tx.objectStore('strategies');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // --- SETTINGS ---
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    await this.init();
    if (!this.db) {
      try {
        const val = localStorage.getItem(`setting_${key}`);
        return val ? JSON.parse(val) : defaultValue;
      } catch {
        return defaultValue;
      }
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
        req.onerror = () => resolve(defaultValue);
      } catch {
        resolve(defaultValue);
      }
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await this.init();
    if (!this.db) {
      try {
        localStorage.setItem(`setting_${key}`, JSON.stringify(value));
      } catch {}
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const req = store.put({ key, value });
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
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

    // 1. Clear all localStorage keys
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // 2. Clear all object stores if DB is open
    if (this.db) {
      try {
        const tx = this.db.transaction(['teams', 'matches', 'strategies', 'settings'], 'readwrite');
        tx.objectStore('teams').clear();
        tx.objectStore('matches').clear();
        tx.objectStore('strategies').clear();
        if (this.db.objectStoreNames.contains('settings')) {
          tx.objectStore('settings').clear();
        }
        await new Promise<void>((resolve) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch (e) {
        console.warn('Object store clear warning:', e);
      }

      try {
        this.db.close();
        this.db = null;
      } catch (e) {
        console.warn('DB close warning:', e);
      }
    }

    // 3. Delete IndexedDB database completely
    try {
      const deleteReq = indexedDB.deleteDatabase(DB_NAME);
      await new Promise<void>((resolve) => {
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => resolve();
        deleteReq.onblocked = () => resolve();
      });
    } catch (e) {
      console.warn('Database deletion warning:', e);
    }

    this.isReadyPromise = null;
  }

  async seedInitialDataIfEmpty(): Promise<boolean> {
    return false;
  }
}

export const scoutingDB = new ScoutingDB();
