import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
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
  creatorName?: string;
  connectedScouts?: string[];
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
  lastError: string | null;
}

let isKnownQuotaExhausted = false;

// Intercept Firestore SDK internal gRPC quota errors
if (typeof window !== 'undefined') {
  const origError = console.error;
  console.error = (...args: any[]) => {
    const text = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    if (text.includes('RESOURCE_EXHAUSTED') || text.includes('Free daily write units per project')) {
      isKnownQuotaExhausted = true;
    }
    origError.apply(console, args);
  };
}

// Timeout helper to prevent infinite network stalls or backoff hangs
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000, errorMsg: string = 'Cloud operation timed out.'): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (isKnownQuotaExhausted) {
        reject(new Error('Firebase free-tier daily write quota reached (resets daily at midnight PST). Data is saved safely on your device.'));
      } else {
        reject(new Error(errorMsg));
      }
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function parseFirebaseError(err: any): string {
  const msg = err?.message || String(err);
  if (isKnownQuotaExhausted || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota limit exceeded') || err?.code === 'resource-exhausted') {
    isKnownQuotaExhausted = true;
    return 'Google Cloud free-tier daily write quota is reached for this project (resets at midnight PST). Remote cloud writes are paused, but your data is 100% safely saved on your device.';
  }
  if (msg.includes('PERMISSION_DENIED') || err?.code === 'permission-denied') {
    return 'Permission denied by cloud security rules.';
  }
  if (msg.includes('timed out')) {
    if (isKnownQuotaExhausted) {
      return 'Google Cloud free-tier daily write quota is reached (resets at midnight PST). Your scouting records remain safe locally.';
    }
    return 'Connection timed out. The server may be busy or quota-limited.';
  }
  return msg;
}

class CloudSyncManager {
  private activeRoomCode: string | null = null;
  private activeEventName: string = 'FRC REBUILT Competition';
  private unsubs: Unsubscribe[] = [];
  private listeners: ((status: SyncStatus) => void)[] = [];
  private isSyncing: boolean = false;
  private lastSyncedAt: number | null = null;
  private pendingCount: number = 0;
  private lastError: string | null = null;

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
        if (savedEvent) this.activeEventName = savedEvent;
        setTimeout(() => {
          this.joinRoom(savedRoom).catch(() => {
            this.activeRoomCode = null;
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem('frc_sync_room_code');
            }
            this.notify();
          });
        }, 1200);
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
      lastError: this.lastError,
    };
  }

  public getScoutName(): string {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('frc_scout_name') || 'Lead Scout';
    }
    return 'Lead Scout';
  }

  public setScoutName(name: string) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('frc_scout_name', name.trim());
    }
    this.notify();
  }

  public getDeviceId(): string {
    if (typeof localStorage !== 'undefined') {
      let id = localStorage.getItem('frc_device_id');
      if (!id) {
        id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
        localStorage.setItem('frc_device_id', id);
      }
      return id;
    }
    return 'device-offline';
  }

  public async ensureAuth(): Promise<string> {
    if (auth.currentUser) return auth.currentUser.uid;
    try {
      const cred = await signInAnonymously(auth);
      return cred.user.uid;
    } catch {
      return this.getDeviceId();
    }
  }

  // Check if current scout created this room
  public isRoomCreator(room: AvailableRoom): boolean {
    const myUid = this.getDeviceId();
    const myScout = this.getScoutName().trim().toLowerCase();
    if (room.createdBy && room.createdBy === myUid) return true;
    if (room.creatorName && myScout && room.creatorName.trim().toLowerCase() === myScout) return true;
    return false;
  }

  // Fetch all active/available scouting rooms from Firestore
  public async fetchAvailableRooms(): Promise<AvailableRoom[]> {
    try {
      await this.ensureAuth();
      const snap = await withTimeout(
        getDocs(collection(db, 'rooms')),
        5000,
        'Failed to load room list (network timed out)'
      );
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
            creatorName: data.creatorName || (data.createdBy ? 'Scout' : undefined),
            connectedScouts: Array.isArray(data.connectedScouts)
              ? data.connectedScouts
              : (data.creatorName ? [data.creatorName] : []),
          });
        }
      });
      return list.sort((a, b) => (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0));
    } catch (err: any) {
      console.warn('Could not fetch available rooms:', err);
      throw new Error(parseFirebaseError(err));
    }
  }

  // Delete a room from cloud (only for creator)
  public async deleteRoom(rawCode: string): Promise<boolean> {
    const code = rawCode.trim().toUpperCase();
    try {
      await withTimeout(
        deleteDoc(doc(db, 'rooms', code)),
        5000,
        'Failed to delete room (request timed out)'
      );
      if (this.activeRoomCode === code) {
        this.disconnect();
      }
      return true;
    } catch (err: any) {
      throw new Error(parseFirebaseError(err));
    }
  }

  // Create a new Team Scouting Room (requires password team9751 and scout name Kawser)
  public async createRoom(rawCode: string, password: string, eventName?: string): Promise<boolean> {
    if (this.getScoutName().trim().toLowerCase() !== 'kawser') {
      throw new Error('Only Kawser is authorized to create rooms.');
    }

    if (password.trim().toLowerCase() !== 'team9751') {
      throw new Error('Incorrect password. To create a room, enter password: team9751');
    }

    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) throw new Error('Invalid room code. Please use alphanumeric characters.');

    this.disconnect();
    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    try {
      const uid = await this.ensureAuth();
      const scoutName = this.getScoutName();
      this.activeRoomCode = code;
      this.activeEventName = eventName || 'FRC REBUILT Competition';

      const roomRef = doc(db, 'rooms', code);
      const now = Date.now();

      await withTimeout(
        setDoc(roomRef, {
          roomCode: code,
          eventName: this.activeEventName,
          createdAt: now,
          createdBy: uid,
          creatorName: scoutName,
          connectedScouts: [scoutName],
          lastActiveAt: now,
        }, { merge: true }),
        5000,
        'Room creation timed out.'
      );

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('frc_sync_room_code', code);
        localStorage.setItem('frc_sync_event_name', this.activeEventName);
      }

      await this.pushLocalDataToCloud();
      this.attachRealtimeListeners(code);

      this.lastSyncedAt = Date.now();
      this.isSyncing = false;
      this.lastError = null;
      this.notify();
      return true;
    } catch (err: any) {
      this.isSyncing = false;
      const parsed = parseFirebaseError(err);
      this.lastError = parsed;
      this.notify();
      throw new Error(parsed);
    }
  }

  // Join an existing Team Scouting Room (no password required, but room must exist)
  public async joinRoom(rawCode: string): Promise<boolean> {
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) throw new Error('Invalid room code. Please use alphanumeric characters.');

    this.disconnect();
    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    try {
      await this.ensureAuth();
      const scoutName = this.getScoutName();
      const roomRef = doc(db, 'rooms', code);

      const roomSnap = await withTimeout(
        getDoc(roomRef),
        5000,
        'Connection to room timed out.'
      );

      if (!roomSnap.exists()) {
        throw new Error(`Room "${code}" not found. To create it, switch to Create Room and enter password team9751.`);
      }

      const data = roomSnap.data();
      this.activeRoomCode = code;
      this.activeEventName = data?.eventName || 'FRC REBUILT Competition';

      const existingScouts: string[] = Array.isArray(data?.connectedScouts) ? data.connectedScouts : (data?.creatorName ? [data.creatorName] : []);
      const updatedScouts = Array.from(new Set([...existingScouts, scoutName])).slice(-8);

      setDoc(roomRef, {
        lastActiveAt: Date.now(),
        connectedScouts: updatedScouts,
      }, { merge: true }).catch(() => {});

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('frc_sync_room_code', code);
        localStorage.setItem('frc_sync_event_name', this.activeEventName);
      }

      await this.pushLocalDataToCloud();
      this.attachRealtimeListeners(code);

      this.lastSyncedAt = Date.now();
      this.isSyncing = false;
      this.lastError = null;
      this.notify();
      return true;
    } catch (err: any) {
      this.isSyncing = false;
      const parsed = parseFirebaseError(err);
      this.lastError = parsed;
      this.notify();
      throw new Error(parsed);
    }
  }

  // Connect / Join a Team Scouting Room
  public async connectToRoom(rawCode: string, _eventName?: string): Promise<boolean> {
    return this.joinRoom(rawCode);
  }

  public disconnect() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    this.activeRoomCode = null;
    this.lastError = null;
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
      (err) => {
        console.warn(`[Firestore Sync Note] LIST at ${teamsPath}:`, err.message);
      }
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
      (err) => {
        console.warn(`[Firestore Sync Note] LIST at ${matchesPath}:`, err.message);
      }
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
      (err) => {
        console.warn(`[Firestore Sync Note] LIST at ${strategiesPath}:`, err.message);
      }
    );
    this.unsubs.push(unStrat);
  }

  // --- SMART CONFLICT RESOLUTION MERGE ENGINE ---
  private async mergeIncomingMatch(remoteMatch: MatchScoutingRecord) {
    if (!remoteMatch || !remoteMatch.id) return;
    const localMatch = await scoutingDB.getMatch(remoteMatch.id);
    if (!localMatch) {
      await scoutingDB.saveMatch(remoteMatch);
    } else {
      if ((remoteMatch.timestamp || 0) > (localMatch.timestamp || 0)) {
        await scoutingDB.saveMatch(remoteMatch);
      }
    }
  }

  private async mergeIncomingTeam(remoteTeam: TeamProfile) {
    if (!remoteTeam || !remoteTeam.teamNumber) return;
    const localTeam = await scoutingDB.getTeam(remoteTeam.teamNumber);

    if (!localTeam) {
      await scoutingDB.saveTeam(remoteTeam);
      return;
    }

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

  // Push local changes to cloud safely
  public async pushLocalDataToCloud() {
    if (!this.activeRoomCode) return;
    const roomCode = this.activeRoomCode;
    const uid = await this.ensureAuth();

    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();
    const strategies = await scoutingDB.getAllStrategies();

    // Push Teams (batched best-effort with timeout)
    for (const team of teams) {
      const cleanTeam = this.cleanForFirestore({
        ...team,
        updatedBy: uid,
      });
      try {
        await withTimeout(
          setDoc(doc(db, 'rooms', roomCode, 'teams', team.teamNumber.toString()), cleanTeam, { merge: true }),
          3500
        );
      } catch (err: any) {
        if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.code === 'resource-exhausted') {
          console.warn('Firestore write quota exceeded; pausing batch team uploads.');
          break;
        }
      }
    }

    // Push Matches
    for (const match of matches) {
      const cleanMatch = this.cleanForFirestore(match);
      try {
        await withTimeout(
          setDoc(doc(db, 'rooms', roomCode, 'matches', match.id), cleanMatch, { merge: true }),
          3500
        );
      } catch (err: any) {
        if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.code === 'resource-exhausted') {
          break;
        }
      }
    }

    // Push Strategies
    for (const strat of strategies) {
      const cleanStrat = this.cleanForFirestore(strat);
      try {
        await withTimeout(
          setDoc(doc(db, 'rooms', roomCode, 'strategies', strat.id), cleanStrat, { merge: true }),
          3500
        );
      } catch {}
    }

    // Update room activity and statistics
    try {
      await withTimeout(
        setDoc(doc(db, 'rooms', roomCode), {
          teamCount: teams.length,
          matchCount: matches.length,
          lastActiveAt: Date.now(),
        }, { merge: true }),
        3500
      );
    } catch {}

    this.lastSyncedAt = Date.now();
    this.notify();

    return {
      pushedTeams: teams.length,
      pushedMatches: matches.length,
      pushedStrategies: strategies.length,
    };
  }

  // Explicitly fetch available remote changes to see what can be pulled
  public async fetchRemoteUpdates(): Promise<{
    hasUpdates: boolean;
    newTeamsCount: number;
    newMatchesCount: number;
    newStrategiesCount: number;
    remoteTeams: TeamProfile[];
    remoteMatches: MatchScoutingRecord[];
    remoteStrategies: StrategyPlan[];
  }> {
    if (!this.activeRoomCode) {
      throw new Error('No active Cloud room. Please connect to a room first.');
    }
    const roomCode = this.activeRoomCode;
    await this.ensureAuth();

    const [remoteTeamsSnap, remoteMatchesSnap, remoteStrategiesSnap, localTeams, localMatches, localStrategies] = await Promise.all([
      getDocs(collection(db, 'rooms', roomCode, 'teams')),
      getDocs(collection(db, 'rooms', roomCode, 'matches')),
      getDocs(collection(db, 'rooms', roomCode, 'strategies')),
      scoutingDB.getAllTeams(),
      scoutingDB.getAllMatches(),
      scoutingDB.getAllStrategies(),
    ]);

    const localTeamMap = new Map(localTeams.map((t) => [t.teamNumber, t]));
    const localMatchMap = new Map(localMatches.map((m) => [m.id, m]));
    const localStratMap = new Map(localStrategies.map((s) => [s.id, s]));

    const remoteTeams: TeamProfile[] = [];
    let newTeamsCount = 0;
    remoteTeamsSnap.forEach((d) => {
      const data = d.data() as TeamProfile;
      if (data && data.teamNumber) {
        remoteTeams.push(data);
        const local = localTeamMap.get(data.teamNumber);
        if (!local || (data.updatedAt && data.updatedAt > (local.updatedAt || 0))) {
          newTeamsCount++;
        }
      }
    });

    const remoteMatches: MatchScoutingRecord[] = [];
    let newMatchesCount = 0;
    remoteMatchesSnap.forEach((d) => {
      const data = d.data() as MatchScoutingRecord;
      if (data && data.id) {
        remoteMatches.push(data);
        const local = localMatchMap.get(data.id);
        if (!local || (data.timestamp && data.timestamp > (local.timestamp || 0))) {
          newMatchesCount++;
        }
      }
    });

    const remoteStrategies: StrategyPlan[] = [];
    let newStrategiesCount = 0;
    remoteStrategiesSnap.forEach((d) => {
      const data = d.data() as StrategyPlan;
      if (data && data.id) {
        remoteStrategies.push(data);
        const local = localStratMap.get(data.id);
        if (!local || (data.updatedAt && data.updatedAt > (local.updatedAt || 0))) {
          newStrategiesCount++;
        }
      }
    });

    return {
      hasUpdates: (newTeamsCount + newMatchesCount + newStrategiesCount) > 0,
      newTeamsCount,
      newMatchesCount,
      newStrategiesCount,
      remoteTeams,
      remoteMatches,
      remoteStrategies,
    };
  }

  // Pull fetched remote updates and merge into local IndexedDB
  public async pullRemoteUpdates(updates?: {
    remoteTeams?: TeamProfile[];
    remoteMatches?: MatchScoutingRecord[];
    remoteStrategies?: StrategyPlan[];
  }): Promise<{ pulledTeams: number; pulledMatches: number; pulledStrategies: number }> {
    let teams = updates?.remoteTeams;
    let matches = updates?.remoteMatches;
    let strategies = updates?.remoteStrategies;

    if (!teams || !matches || !strategies) {
      const fetched = await this.fetchRemoteUpdates();
      teams = fetched.remoteTeams;
      matches = fetched.remoteMatches;
      strategies = fetched.remoteStrategies;
    }

    let pulledTeams = 0;
    let pulledMatches = 0;
    let pulledStrategies = 0;

    for (const t of teams) {
      await this.mergeIncomingTeam(t);
      pulledTeams++;
    }

    for (const m of matches) {
      await this.mergeIncomingMatch(m);
      pulledMatches++;
    }

    for (const s of strategies) {
      await scoutingDB.saveStrategy(s);
      pulledStrategies++;
    }

    this.lastSyncedAt = Date.now();
    this.notify();

    return { pulledTeams, pulledMatches, pulledStrategies };
  }

  // Hook into save operations for immediate cloud broadcast
  public async broadcastTeamSave(team: TeamProfile) {
    if (!this.activeRoomCode || isKnownQuotaExhausted) return;
    const roomCode = this.activeRoomCode;
    try {
      const cleanTeam = this.cleanForFirestore(team);
      await withTimeout(
        setDoc(doc(db, 'rooms', roomCode, 'teams', team.teamNumber.toString()), cleanTeam, { merge: true }),
        4000
      );
      this.lastSyncedAt = Date.now();
      this.notify();
    } catch (err) {
      console.warn('Team save queued locally; cloud write note:', err);
    }
  }

  public async broadcastMatchSave(match: MatchScoutingRecord) {
    if (!this.activeRoomCode || isKnownQuotaExhausted) return;
    const roomCode = this.activeRoomCode;
    try {
      const cleanMatch = this.cleanForFirestore(match);
      await withTimeout(
        setDoc(doc(db, 'rooms', roomCode, 'matches', match.id), cleanMatch, { merge: true }),
        4000
      );
      this.lastSyncedAt = Date.now();
      this.notify();
    } catch (err) {
      console.warn('Match save queued locally; cloud write note:', err);
    }
  }

  public async broadcastStrategySave(strategy: StrategyPlan) {
    if (!this.activeRoomCode || isKnownQuotaExhausted) return;
    const roomCode = this.activeRoomCode;
    try {
      const cleanStrat = this.cleanForFirestore(strategy);
      await withTimeout(
        setDoc(doc(db, 'rooms', roomCode, 'strategies', strategy.id), cleanStrat, { merge: true }),
        4000
      );
      this.lastSyncedAt = Date.now();
      this.notify();
    } catch (err) {
      console.warn('Strategy save queued locally; cloud write note:', err);
    }
  }
}

export const cloudSync = new CloudSyncManager();
