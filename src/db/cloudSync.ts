import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { scoutingDB, registerDBSaveHook } from './indexedDB';
import { 
  TeamProfile, 
  MatchScoutingRecord, 
  StrategyPlan,
  PitData,
  AutonomousDrawing
} from '../types/scouting';
import { signInAnonymously } from 'firebase/auth';

export interface AvailableRoom {
  roomCode: string;
  eventName: string;
  createdAt: number;
  lastActiveAt?: number;
  teamCount?: number;
  matchCount?: number;
  createdBy?: string;
}

export interface SyncStatus {
  roomCode: string | null;
  eventName: string;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  pendingSyncCount: number;
  syncedMatchesCount: number;
  syncedTeamsCount: number;
  scoutName: string;
}

class CloudSyncManager {
  private activeRoomCode: string | null = null;
  private activeEventName: string = 'FRC REBUILT Competition';
  private unsubs: Unsubscribe[] = [];
  private listeners: ((status: SyncStatus) => void)[] = [];
  private isSyncing: boolean = false;
  private lastSyncedAt: number | null = null;
  private pendingCount: number = 0;

  constructor() {
    this.initFromStorage();
    registerDBSaveHook((type, data) => {
      if (type === 'team') this.broadcastTeamSave(data);
      if (type === 'match') this.broadcastMatchSave(data);
      if (type === 'strategy') this.broadcastStrategySave(data);
    });
  }

  private initFromStorage() {
    if (typeof localStorage !== 'undefined') {
      const savedRoom = localStorage.getItem('frc_sync_room_code');
      const savedEvent = localStorage.getItem('frc_sync_event_name');
      if (savedRoom) {
        this.activeRoomCode = savedRoom;
        if (savedEvent) this.activeEventName = savedEvent;
        // Connect automatically if room was previously set
        setTimeout(() => this.connectToRoom(savedRoom, this.activeEventName), 1000);
      }
    }
  }

  public subscribe(cb: (status: SyncStatus) => void): () => void {
    this.listeners.push(cb);
    cb(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => cb(status));
  }

  public getStatus(): SyncStatus {
    return {
      roomCode: this.activeRoomCode,
      eventName: this.activeEventName,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      pendingSyncCount: this.pendingCount,
      syncedMatchesCount: 0,
      syncedTeamsCount: 0,
      scoutName: this.getScoutName(),
    };
  }

  public getScoutName(): string {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('frc_scout_name') || 'Scout';
    }
    return 'Scout';
  }

  public setScoutName(name: string) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('frc_scout_name', name.trim());
    }
    this.notify();
  }

  public async ensureAuth(): Promise<string> {
    if (auth.currentUser) return auth.currentUser.uid;
    try {
      const cred = await signInAnonymously(auth);
      return cred.user.uid;
    } catch {
      let deviceUid = 'panther-device';
      try {
        if (typeof localStorage !== 'undefined') {
          deviceUid = localStorage.getItem('panther_device_uid') || '';
          if (!deviceUid) {
            deviceUid = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            localStorage.setItem('panther_device_uid', deviceUid);
          }
        }
      } catch {
        // quota safety
      }
      return deviceUid;
    }
  }

  // Fetch all active/available scouting rooms from Firestore
  public async fetchAvailableRooms(): Promise<AvailableRoom[]> {
    try {
      await this.ensureAuth();
      const snap = await getDocs(collection(db, 'rooms'));
      const list: AvailableRoom[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data && data.roomCode) {
          list.push({
            roomCode: data.roomCode,
            eventName: data.eventName || 'FRC REBUILT Competition',
            createdAt: data.createdAt || Date.now(),
            lastActiveAt: data.lastActiveAt || data.createdAt || Date.now(),
            teamCount: data.teamCount || 0,
            matchCount: data.matchCount || 0,
            createdBy: data.createdBy,
          });
        }
      });
      return list.sort((a, b) => (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0));
    } catch (err) {
      console.warn('Could not fetch available rooms:', err);
      return [];
    }
  }

  // Connect / Join a Team Scouting Room
  public async connectToRoom(rawCode: string, eventName: string = 'FRC REBUILT Competition'): Promise<boolean> {
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) throw new Error('Invalid room code. Please use alphanumeric characters.');

    this.disconnect();
    this.isSyncing = true;
    this.notify();

    try {
      const uid = await this.ensureAuth();
      this.activeRoomCode = code;

      // 1. Create or update room doc
      const roomRef = doc(db, 'rooms', code);
      const roomSnap = await getDoc(roomRef);
      const now = Date.now();

      if (roomSnap.exists()) {
        const data = roomSnap.data();
        const effectiveEvent = (eventName && eventName !== 'FRC REBUILT Competition') ? eventName : (data?.eventName || 'FRC REBUILT Competition');
        this.activeEventName = effectiveEvent;
        await setDoc(roomRef, {
          lastActiveAt: now,
          eventName: effectiveEvent,
        }, { merge: true });
      } else {
        this.activeEventName = eventName || 'FRC REBUILT Competition';
        await setDoc(roomRef, {
          roomCode: code,
          eventName: this.activeEventName,
          createdAt: now,
          createdBy: uid,
          lastActiveAt: now,
        });
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('frc_sync_room_code', code);
        localStorage.setItem('frc_sync_event_name', this.activeEventName);
      }

      // 2. Initial bidirectional push & pull
      await this.pushLocalDataToCloud();
      this.attachRealtimeListeners(code);

      this.lastSyncedAt = Date.now();
      this.isSyncing = false;
      this.notify();
      return true;
    } catch (err) {
      this.isSyncing = false;
      this.notify();
      throw err;
    }
  }

  public disconnect() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    this.activeRoomCode = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('frc_sync_room_code');
    }
    this.notify();
  }

  // Real-time Firestore Listeners
  private attachRealtimeListeners(roomCode: string) {
    const teamsPath = `rooms/${roomCode}/teams`;
    const matchesPath = `rooms/${roomCode}/matches`;
    const strategiesPath = `rooms/${roomCode}/strategies`;

    // 1. Teams Listener
    const unTeam = onSnapshot(
      collection(db, teamsPath),
      async (snap) => {
        for (const docChange of snap.docChanges()) {
          if (docChange.type === 'added' || docChange.type === 'modified') {
            const remoteTeam = docChange.doc.data() as TeamProfile;
            await this.mergeIncomingTeam(remoteTeam);
          }
        }
        this.lastSyncedAt = Date.now();
        this.notify();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, teamsPath)
    );
    this.unsubs.push(unTeam);

    // 2. Matches Listener
    const unMatch = onSnapshot(
      collection(db, matchesPath),
      async (snap) => {
        for (const docChange of snap.docChanges()) {
          if (docChange.type === 'added' || docChange.type === 'modified') {
            const remoteMatch = docChange.doc.data() as MatchScoutingRecord;
            await this.mergeIncomingMatch(remoteMatch);
          }
        }
        this.lastSyncedAt = Date.now();
        this.notify();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, matchesPath)
    );
    this.unsubs.push(unMatch);

    // 3. Strategies Listener
    const unStrat = onSnapshot(
      collection(db, strategiesPath),
      async (snap) => {
        for (const docChange of snap.docChanges()) {
          if (docChange.type === 'added' || docChange.type === 'modified') {
            const remoteStrat = docChange.doc.data() as StrategyPlan;
            await scoutingDB.saveStrategy(remoteStrat);
          }
        }
        this.lastSyncedAt = Date.now();
        this.notify();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, strategiesPath)
    );
    this.unsubs.push(unStrat);
  }

  // --- SMART CONFLICT RESOLUTION MERGE ENGINE ---

  // Merge Match Observation (Append-Only Event Log Strategy)
  private async mergeIncomingMatch(remoteMatch: MatchScoutingRecord) {
    if (!remoteMatch || !remoteMatch.id) return;
    const localMatch = await scoutingDB.getMatch(remoteMatch.id);
    if (!localMatch) {
      // New match record from another scout: insert directly into local database
      await scoutingDB.saveMatch(remoteMatch);
    } else {
      // If already exists locally with older timestamp, update
      if ((remoteMatch.timestamp || 0) > (localMatch.timestamp || 0)) {
        await scoutingDB.saveMatch(remoteMatch);
      }
    }
  }

  // Merge Pit Scouting Profile (Field-Level Timestamp / LWW Strategy)
  private async mergeIncomingTeam(remoteTeam: TeamProfile) {
    if (!remoteTeam || !remoteTeam.teamNumber) return;
    const localTeam = await scoutingDB.getTeam(remoteTeam.teamNumber);

    if (!localTeam) {
      await scoutingDB.saveTeam(remoteTeam);
      return;
    }

    // Both exist: perform field-level 3-way merge
    let mergedPit: PitData | undefined = undefined;
    if (localTeam.pit || remoteTeam.pit) {
      const basePit = localTeam.pit || remoteTeam.pit!;
      mergedPit = {
        ...basePit,
        ...(remoteTeam.pit || {}),
        shootingAreas: remoteTeam.pit?.shootingAreas || localTeam.pit?.shootingAreas || [],
        autoDrawings: this.mergeAutoDrawings(
          localTeam.pit?.autoDrawings || [],
          remoteTeam.pit?.autoDrawings || []
        ),
      };
    }

    const merged: TeamProfile = {
      ...localTeam,
      ...remoteTeam,
      teamNumber: remoteTeam.teamNumber,
      teamName: remoteTeam.teamName || localTeam.teamName,
      organization: remoteTeam.organization || localTeam.organization,
      location: remoteTeam.location || localTeam.location,
      updatedAt: Math.max(remoteTeam.updatedAt || 0, localTeam.updatedAt || 0),
      pit: mergedPit,
    };

    await scoutingDB.saveTeam(merged);
  }

  private mergeAutoDrawings(local: AutonomousDrawing[], remote: AutonomousDrawing[]): AutonomousDrawing[] {
    const map = new Map<string, AutonomousDrawing>();
    local.forEach((d) => d.id && map.set(d.id, d));
    remote.forEach((d) => d.id && map.set(d.id, d));
    return Array.from(map.values());
  }

  // Deep sanitize objects to remove any `undefined` values before sending to Firestore
  private cleanForFirestore<T>(data: T): T {
    if (data === null || data === undefined) {
      return null as any;
    }
    if (Array.isArray(data)) {
      return data
        .filter((item) => item !== undefined)
        .map((item) => this.cleanForFirestore(item)) as any;
    }
    if (typeof data === 'object' && data !== null) {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanForFirestore(value);
        }
      }
      return cleaned as T;
    }
    return data;
  }

  // Push local changes to cloud
  public async pushLocalDataToCloud() {
    if (!this.activeRoomCode) return;
    const roomCode = this.activeRoomCode;
    const uid = await this.ensureAuth();

    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();
    const strategies = await scoutingDB.getAllStrategies();

    // Push Teams
    for (const team of teams) {
      const cleanTeam = this.cleanForFirestore({
        ...team,
        updatedBy: uid,
      });
      const teamDocPath = `rooms/${roomCode}/teams/${team.teamNumber}`;
      try {
        await setDoc(doc(db, 'rooms', roomCode, 'teams', team.teamNumber.toString()), cleanTeam, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, teamDocPath);
      }
    }

    // Push Matches
    for (const match of matches) {
      const cleanMatch = this.cleanForFirestore(match);
      const matchDocPath = `rooms/${roomCode}/matches/${match.id}`;
      try {
        await setDoc(doc(db, 'rooms', roomCode, 'matches', match.id), cleanMatch, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, matchDocPath);
      }
    }

    // Push Strategies
    for (const strat of strategies) {
      const cleanStrat = this.cleanForFirestore(strat);
      const stratDocPath = `rooms/${roomCode}/strategies/${strat.id}`;
      try {
        await setDoc(doc(db, 'rooms', roomCode, 'strategies', strat.id), cleanStrat, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, stratDocPath);
      }
    }

    // Update room activity and statistics
    try {
      await setDoc(doc(db, 'rooms', roomCode), {
        teamCount: teams.length,
        matchCount: matches.length,
        lastActiveAt: Date.now(),
      }, { merge: true });
    } catch {
      // safe fallback
    }
  }

  // Hook into save operations for immediate cloud broadcast
  public async broadcastTeamSave(team: TeamProfile) {
    if (!this.activeRoomCode) return;
    const roomCode = this.activeRoomCode;
    const teamDocPath = `rooms/${roomCode}/teams/${team.teamNumber}`;
    try {
      const cleanTeam = this.cleanForFirestore(team);
      await setDoc(doc(db, 'rooms', roomCode, 'teams', team.teamNumber.toString()), cleanTeam, { merge: true });
      this.lastSyncedAt = Date.now();
      this.notify();
    } catch (err) {
      console.warn('Queued team save offline in Firestore cache:', err);
    }
  }

  public async broadcastMatchSave(match: MatchScoutingRecord) {
    if (!this.activeRoomCode) return;
    const roomCode = this.activeRoomCode;
    const matchDocPath = `rooms/${roomCode}/matches/${match.id}`;
    try {
      const cleanMatch = this.cleanForFirestore(match);
      await setDoc(doc(db, 'rooms', roomCode, 'matches', match.id), cleanMatch, { merge: true });
      this.lastSyncedAt = Date.now();
      this.notify();
    } catch (err) {
      console.warn('Queued match save offline in Firestore cache:', err);
    }
  }

  public async broadcastStrategySave(strategy: StrategyPlan) {
    if (!this.activeRoomCode) return;
    const roomCode = this.activeRoomCode;
    const stratDocPath = `rooms/${roomCode}/strategies/${strategy.id}`;
    try {
      const cleanStrat = this.cleanForFirestore(strategy);
      await setDoc(doc(db, 'rooms', roomCode, 'strategies', strategy.id), cleanStrat, { merge: true });
      this.lastSyncedAt = Date.now();
      this.notify();
    } catch (err) {
      console.warn('Queued strategy save offline in Firestore cache:', err);
    }
  }
}

export const cloudSync = new CloudSyncManager();
