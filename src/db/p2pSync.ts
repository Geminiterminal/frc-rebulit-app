import Peer, { DataConnection } from 'peerjs';
import { scoutingDB, registerDBSaveHook } from './indexedDB';
import { db } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  TeamProfile, 
  MatchScoutingRecord, 
  StrategyPlan 
} from '../types/scouting';

export interface P2PPeerInfo {
  id: string;
  scoutName: string;
  isHost: boolean;
  connectedAt: number;
}

export interface P2PAvailableRoom {
  roomCode: string;
  creatorName: string;
  lastActiveAt: number;
}

export interface P2PStatus {
  roomCode: string | null;
  isHost: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  peerCount: number;
  peers: P2PPeerInfo[];
  scoutName: string;
  lastSyncedAt: number | null;
  errorMsg: string | null;
}

export type P2PMessageType = 
  | 'JOIN_ROOM'
  | 'ROOM_STATE'
  | 'PUSH_MATCH'
  | 'PUSH_TEAM'
  | 'PUSH_STRATEGY'
  | 'PING'
  | 'PONG';

export interface P2PMessage {
  type: P2PMessageType;
  senderScoutName: string;
  senderPeerId: string;
  payload?: any;
  timestamp: number;
}

class P2PSyncEngine {
  private peer: Peer | null = null;
  private roomCode: string | null = null;
  private isHost: boolean = false;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private listeners: ((status: P2PStatus) => void)[] = [];
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private lastSyncedAt: number | null = null;
  private errorMsg: string | null = null;
  private heartbeatTimer: any = null;

  constructor() {
    this.initFromStorage();
    registerDBSaveHook((type, data) => {
      if (type === 'match') this.broadcastMatch(data);
      if (type === 'team') this.broadcastTeam(data);
      if (type === 'strategy') this.broadcastStrategy(data);
    });
  }

  private initFromStorage() {
    if (typeof localStorage !== 'undefined') {
      const savedRoom = localStorage.getItem('frc_p2p_room');
      if (savedRoom) {
        setTimeout(() => {
          this.joinRoom(savedRoom).catch(() => {
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem('frc_p2p_room');
            }
          });
        }, 1000);
      }
    }
  }

  public subscribe(cb: (status: P2PStatus) => void): () => void {
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

  public getStatus(): P2PStatus {
    const peersList: P2PPeerInfo[] = Array.from(this.connections.entries()).map(([id, conn]) => ({
      id,
      scoutName: (conn as any).peerScoutName || 'Peer Scout',
      isHost: false,
      connectedAt: (conn as any).connectedAt || Date.now(),
    }));

    return {
      roomCode: this.roomCode,
      isHost: this.isHost,
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      peerCount: this.connections.size + (this.hostConnection ? 1 : 0),
      peers: peersList,
      scoutName: this.getScoutName(),
      lastSyncedAt: this.lastSyncedAt,
      errorMsg: this.errorMsg,
    };
  }

  private cleanRoomCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  private getHostPeerId(code: string): string {
    return `FRC-ROOM-${code}`;
  }

  private getUniquePeerId(code: string): string {
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `FRC-SCOUT-${code}-${rand}`;
  }

  // Create / Host a P2P Room (requires password team9751 and scout name Kawser)
  public async createRoom(rawCode: string, password: string): Promise<boolean> {
    if (this.getScoutName().trim().toLowerCase() !== 'kawser') {
      throw new Error('Only Kawser is authorized to create rooms.');
    }

    if (password.trim().toLowerCase() !== 'team9751') {
      throw new Error('Incorrect password. To create a room, enter password: team9751');
    }

    const code = this.cleanRoomCode(rawCode);
    if (!code) throw new Error('Invalid room code. Please use alphanumeric characters.');

    this.disconnect();
    this.roomCode = code;
    this.isConnecting = true;
    this.errorMsg = null;
    this.notify();

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('frc_p2p_room', code);
    }

    const hostId = this.getHostPeerId(code);

    return new Promise((resolve, reject) => {
      try {
        const hostPeer = new Peer(hostId, {
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          },
        });

        hostPeer.on('open', () => {
          this.peer = hostPeer;
          this.isHost = true;
          this.isConnected = true;
          this.isConnecting = false;
          this.notify();

          hostPeer.on('connection', (conn) => {
            this.connections.set(conn.peer, conn);
            (conn as any).connectedAt = Date.now();
            (conn as any).peerScoutName = conn.metadata?.scoutName || 'Scout';
            this.notify();

            this.setupConnectionHandlers(conn);
            this.syncAllLocalDataToConn(conn);
          });

          // Register active P2P room in Firestore so other scouts can scan and discover it
          const registerRoom = async () => {
            try {
              const roomRef = doc(db, 'p2p_rooms', code);
              await setDoc(roomRef, {
                roomCode: code,
                creatorName: this.getScoutName(),
                createdAt: Date.now(),
                lastActiveAt: Date.now(),
              }, { merge: true });
            } catch (err) {
              console.warn('Could not register P2P room in Firestore:', err);
            }
          };

          registerRoom();

          if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = setInterval(() => {
            if (this.isHost && this.roomCode) {
              const roomRef = doc(db, 'p2p_rooms', this.roomCode);
              setDoc(roomRef, { lastActiveAt: Date.now() }, { merge: true }).catch(() => {});
            }
          }, 15000);

          this.saveKnownP2PRoom(code, this.getScoutName());
          resolve(true);
        });

        hostPeer.on('error', (err: any) => {
          this.isConnecting = false;
          this.isConnected = false;
          this.errorMsg = err.type === 'unavailable-id'
            ? `Room ${code} is already being hosted by another device.`
            : `Failed to create P2P room: ${err.message || 'Network error'}`;
          this.notify();
          reject(new Error(this.errorMsg));
        });
      } catch (err: any) {
        this.isConnecting = false;
        this.notify();
        reject(new Error(err.message || 'Could not initialize P2P host.'));
      }
    });
  }

  // Join an existing P2P Room (no password required, connects to room host)
  public async joinRoom(rawCode: string): Promise<boolean> {
    const code = this.cleanRoomCode(rawCode);
    if (!code) throw new Error('Invalid room code. Please use alphanumeric characters.');

    this.disconnect();
    this.roomCode = code;
    this.isConnecting = true;
    this.errorMsg = null;
    this.notify();

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('frc_p2p_room', code);
    }

    const hostId = this.getHostPeerId(code);

    return new Promise((resolve, reject) => {
      let isSettled = false;

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.isConnecting = false;
          this.isConnected = false;
          this.errorMsg = `Room "${code}" host not found. Make sure host created the room and is on the network.`;
          this.notify();
          reject(new Error(this.errorMsg));
        }
      }, 12000);

      try {
        const clientPeer = new Peer(this.getUniquePeerId(code), {
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          },
        });

        clientPeer.on('open', () => {
          const conn = clientPeer.connect(hostId, {
            reliable: true,
            metadata: { scoutName: this.getScoutName() },
          });

          conn.on('open', () => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timer);

            this.peer = clientPeer;
            this.hostConnection = conn;
            this.isHost = false;
            this.isConnected = true;
            this.isConnecting = false;
            this.notify();

            this.setupConnectionHandlers(conn);
            this.sendMessage(conn, 'JOIN_ROOM');
            this.syncAllLocalDataToHost(conn);
            this.saveKnownP2PRoom(code, 'Host');
            resolve(true);
          });

          conn.on('error', (err: any) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timer);
            this.isConnecting = false;
            this.isConnected = false;
            this.errorMsg = `Could not connect to room "${code}" host.`;
            this.notify();
            reject(new Error(this.errorMsg));
          });
        });

        clientPeer.on('error', (err: any) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);
          this.isConnecting = false;
          this.isConnected = false;
          this.errorMsg = `P2P connection error: ${err.message || 'Host unavailable'}`;
          this.notify();
          reject(new Error(this.errorMsg));
        });
      } catch (err: any) {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);
        this.isConnecting = false;
        this.notify();
        reject(new Error(err.message || 'Failed to initialize client peer.'));
      }
    });
  }

  private saveKnownP2PRoom(roomCode: string, creatorName: string) {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem('frc_known_p2p_rooms');
      const list: P2PAvailableRoom[] = raw ? JSON.parse(raw) : [];
      const updated = [
        { roomCode, creatorName, lastActiveAt: Date.now() },
        ...list.filter((r) => r.roomCode !== roomCode),
      ].slice(0, 10);
      localStorage.setItem('frc_known_p2p_rooms', JSON.stringify(updated));
    } catch {}
  }

  // Scan for available active P2P rooms (strictly P2P rooms only)
  public async fetchAvailableRooms(): Promise<P2PAvailableRoom[]> {
    const map = new Map<string, P2PAvailableRoom>();

    // 1. Try Firestore p2p_rooms collection (strictly P2P)
    try {
      const snap = await getDocs(collection(db, 'p2p_rooms'));
      snap.forEach((d) => {
        const data = d.data();
        if (data && data.roomCode) {
          map.set(data.roomCode, {
            roomCode: data.roomCode,
            creatorName: data.creatorName || 'Kawser',
            lastActiveAt: data.lastActiveAt || data.createdAt || Date.now(),
          });
        }
      });
    } catch (e) {
      console.warn('Error fetching p2p_rooms:', e);
    }

    // 2. Include locally known P2P rooms
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('frc_known_p2p_rooms');
        if (raw) {
          const list: P2PAvailableRoom[] = JSON.parse(raw);
          for (const item of list) {
            if (!map.has(item.roomCode)) {
              map.set(item.roomCode, item);
            }
          }
        }
      }
    } catch {}

    return Array.from(map.values()).sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
  }

  // Delete a P2P room from active registry
  public async deleteRoom(roomCode: string): Promise<void> {
    try {
      const roomRef = doc(db, 'p2p_rooms', roomCode);
      await deleteDoc(roomRef);
    } catch {}

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('frc_known_p2p_rooms');
        if (raw) {
          const list: P2PAvailableRoom[] = JSON.parse(raw);
          const filtered = list.filter((r) => r.roomCode !== roomCode);
          localStorage.setItem('frc_known_p2p_rooms', JSON.stringify(filtered));
        }
      }
    } catch {}
  }

  // Connect or Host a P2P Room Code
  public async connectToRoom(rawCode: string): Promise<boolean> {
    return this.joinRoom(rawCode);
  }

  private setupConnectionHandlers(conn: DataConnection) {
    conn.on('data', async (data: any) => {
      if (!data || typeof data !== 'object') return;
      const msg = data as P2PMessage;

      if (msg.senderScoutName) {
        (conn as any).peerScoutName = msg.senderScoutName;
      }

      switch (msg.type) {
        case 'JOIN_ROOM':
          this.syncAllLocalDataToConn(conn);
          break;

        case 'ROOM_STATE':
          if (msg.payload) {
            await this.handleIncomingState(msg.payload);
          }
          break;

        case 'PUSH_MATCH':
          if (msg.payload) {
            await scoutingDB.saveMatch(msg.payload);
            this.lastSyncedAt = Date.now();
            this.notify();
            // Relay to other peers if Host
            if (this.isHost) this.relayToOtherPeers(conn.peer, msg);
          }
          break;

        case 'PUSH_TEAM':
          if (msg.payload) {
            await scoutingDB.saveTeam(msg.payload);
            this.lastSyncedAt = Date.now();
            this.notify();
            if (this.isHost) this.relayToOtherPeers(conn.peer, msg);
          }
          break;

        case 'PUSH_STRATEGY':
          if (msg.payload) {
            await scoutingDB.saveStrategy(msg.payload);
            this.lastSyncedAt = Date.now();
            this.notify();
            if (this.isHost) this.relayToOtherPeers(conn.peer, msg);
          }
          break;
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.hostConnection?.peer === conn.peer) {
        this.hostConnection = null;
        this.isConnected = false;
      }
      this.notify();
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
      this.notify();
    });
  }

  private sendMessage(conn: DataConnection, type: P2PMessageType, payload?: any) {
    if (conn && conn.open) {
      const msg: P2PMessage = {
        type,
        senderScoutName: this.getScoutName(),
        senderPeerId: this.peer?.id || '',
        payload,
        timestamp: Date.now(),
      };
      conn.send(msg);
    }
  }

  private broadcastToAll(type: P2PMessageType, payload?: any) {
    const msg: P2PMessage = {
      type,
      senderScoutName: this.getScoutName(),
      senderPeerId: this.peer?.id || '',
      payload,
      timestamp: Date.now(),
    };

    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(msg);
    }

    this.connections.forEach((conn) => {
      if (conn.open) conn.send(msg);
    });
  }

  private relayToOtherPeers(excludePeerId: string, msg: P2PMessage) {
    this.connections.forEach((conn, id) => {
      if (id !== excludePeerId && conn.open) {
        conn.send(msg);
      }
    });
  }

  private async syncAllLocalDataToConn(conn: DataConnection) {
    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();
    const strategies = await scoutingDB.getAllStrategies();

    this.sendMessage(conn, 'ROOM_STATE', {
      teams,
      matches,
      strategies,
    });
  }

  private async syncAllLocalDataToHost(conn: DataConnection) {
    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();
    const strategies = await scoutingDB.getAllStrategies();

    this.sendMessage(conn, 'ROOM_STATE', {
      teams,
      matches,
      strategies,
    });
  }

  private async handleIncomingState(state: { teams?: TeamProfile[]; matches?: MatchScoutingRecord[]; strategies?: StrategyPlan[] }) {
    if (Array.isArray(state.matches)) {
      for (const m of state.matches) {
        await scoutingDB.saveMatch(m);
      }
    }
    if (Array.isArray(state.teams)) {
      for (const t of state.teams) {
        await scoutingDB.saveTeam(t);
      }
    }
    if (Array.isArray(state.strategies)) {
      for (const s of state.strategies) {
        await scoutingDB.saveStrategy(s);
      }
    }
    this.lastSyncedAt = Date.now();
    this.notify();
  }

  // 1-Click Sync All Data across active scouts
  public async autoSyncOneClick(): Promise<{ matchCount: number; teamCount: number; peerCount: number }> {
    return this.pushLocalData();
  }

  // Explicitly push local scouted data to all connected peers
  public async pushLocalData(): Promise<{ matchCount: number; teamCount: number; peerCount: number }> {
    if (!this.isConnected) {
      const code = this.roomCode || (typeof localStorage !== 'undefined' ? localStorage.getItem('frc_p2p_room') : null);
      if (code) await this.joinRoom(code);
      else throw new Error('Not connected to a P2P room. Please join or create a room first.');
    }

    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();
    const strategies = await scoutingDB.getAllStrategies();

    this.broadcastToAll('ROOM_STATE', { teams, matches, strategies });
    this.lastSyncedAt = Date.now();
    this.notify();

    return {
      matchCount: matches.length,
      teamCount: teams.length,
      peerCount: this.getStatus().peerCount,
    };
  }

  // Explicitly pull / request latest data from connected room peers
  public async pullRemoteData(): Promise<{ matchCount: number; teamCount: number; peerCount: number }> {
    if (!this.isConnected) {
      const code = this.roomCode || (typeof localStorage !== 'undefined' ? localStorage.getItem('frc_p2p_room') : null);
      if (code) await this.joinRoom(code);
      else throw new Error('Not connected to a P2P room. Please join or create a room first.');
    }

    this.broadcastToAll('JOIN_ROOM');
    this.lastSyncedAt = Date.now();
    this.notify();

    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();

    return {
      matchCount: matches.length,
      teamCount: teams.length,
      peerCount: this.getStatus().peerCount,
    };
  }

  public broadcastMatch(match: MatchScoutingRecord) {
    if (!this.isConnected) return;
    this.broadcastToAll('PUSH_MATCH', match);
    this.lastSyncedAt = Date.now();
    this.notify();
  }

  public broadcastTeam(team: TeamProfile) {
    if (!this.isConnected) return;
    this.broadcastToAll('PUSH_TEAM', team);
    this.lastSyncedAt = Date.now();
    this.notify();
  }

  public broadcastStrategy(strategy: StrategyPlan) {
    if (!this.isConnected) return;
    this.broadcastToAll('PUSH_STRATEGY', strategy);
    this.lastSyncedAt = Date.now();
    this.notify();
  }

  public disconnect() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.connections.forEach((conn) => conn.close());
    this.connections.clear();

    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.roomCode = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isHost = false;
    this.errorMsg = null;

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('frc_p2p_room');
    }

    this.notify();
  }
}

export const p2pSync = new P2PSyncEngine();
