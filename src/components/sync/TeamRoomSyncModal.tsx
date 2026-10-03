import React, { useState, useEffect } from 'react';
import { cloudSync, SyncStatus, AvailableRoom } from '../../db/cloudSync';
import { p2pSync, P2PStatus, P2PAvailableRoom } from '../../db/p2pSync';
import { 
  Cloud, 
  Radio, 
  X, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Users, 
  Search, 
  Trash2, 
  LogOut, 
  ArrowRight,
  KeyRound,
  Eye,
  EyeOff,
  Radar
} from 'lucide-react';

interface TeamRoomSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamRoomSyncModal: React.FC<TeamRoomSyncModalProps> = ({ isOpen, onClose }) => {
  const [syncType, setSyncType] = useState<'p2p' | 'cloud'>('p2p');
  const [p2pMode, setP2pMode] = useState<'join' | 'create'>('join');
  const [cloudMode, setCloudMode] = useState<'join' | 'create'>('join');

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(cloudSync.getStatus());
  const [p2pStatus, setP2pStatus] = useState<P2PStatus>(p2pSync.getStatus());

  const [inputP2PRoomCode, setInputP2PRoomCode] = useState('');
  const [p2pPassword, setP2pPassword] = useState('');
  const [showP2pPassword, setShowP2pPassword] = useState(false);

  const [inputCloudRoomCode, setInputCloudRoomCode] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [showCloudPassword, setShowCloudPassword] = useState(false);

  const [scoutName, setScoutName] = useState(p2pSync.getScoutName());
  
  const [availableP2PRooms, setAvailableP2PRooms] = useState<P2PAvailableRoom[]>([]);
  const [isLoadingP2PRooms, setIsLoadingP2PRooms] = useState(false);
  const [connectingP2PCode, setConnectingP2PCode] = useState<string | null>(null);
  const [deletingP2PCode, setDeletingP2PCode] = useState<string | null>(null);

  const [availableCloudRooms, setAvailableCloudRooms] = useState<AvailableRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [p2pSearchQuery, setP2pSearchQuery] = useState('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  
  const [isSyncingP2P, setIsSyncingP2P] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [connectingCloudCode, setConnectingCloudCode] = useState<string | null>(null);
  const [deletingRoomCode, setDeletingRoomCode] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const errorTimeoutRef = React.useRef<any>(null);
  const successTimeoutRef = React.useRef<any>(null);

  const showErrorMsg = (msg: string) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    setErrorMsg(msg);
    errorTimeoutRef.current = setTimeout(() => setErrorMsg(null), 3000);
  };

  const showSuccessMsg = (msg: string) => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setSuccessMsg(msg);
    successTimeoutRef.current = setTimeout(() => setSuccessMsg(null), 3000);
  };

  // User can create rooms ONLY if their scout name is Kawser
  const isKawser = scoutName.trim().toLowerCase() === 'kawser';

  useEffect(() => {
    const unsubCloud = cloudSync.subscribe(setSyncStatus);
    const unsubP2P = p2pSync.subscribe(setP2pStatus);
    return () => {
      unsubCloud();
      unsubP2P();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (syncType === 'cloud') {
        loadCloudRooms();
      } else {
        scanP2PRooms();
      }
    }
  }, [isOpen, syncType]);

  const loadCloudRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const list = await cloudSync.fetchAvailableRooms();
      setAvailableCloudRooms(list);
    } catch {}
    setIsLoadingRooms(false);
  };

  const scanP2PRooms = async () => {
    setIsLoadingP2PRooms(true);
    try {
      const list = await p2pSync.fetchAvailableRooms();
      setAvailableP2PRooms(list);
    } catch {}
    setIsLoadingP2PRooms(false);
  };

  if (!isOpen) return null;

  // --- P2P SYNC TRIGGER ---
  const handleP2PSync = async () => {
    if (!p2pStatus.roomCode || !p2pStatus.isConnected) {
      showErrorMsg('No active P2P room. Please join or create a room first.');
      return;
    }

    setIsSyncingP2P(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await p2pSync.autoSyncOneClick();
      showSuccessMsg(`Synced ${res.matchCount} matches & ${res.teamCount} teams (${res.peerCount} peers)`);
    } catch (err: any) {
      showErrorMsg(err.message || 'P2P sync failed.');
    } finally {
      setIsSyncingP2P(false);
    }
  };

  // Create P2P Room (only Kawser + password team9751)
  const handleCreateP2PRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isKawser) {
      showErrorMsg('Only Kawser is authorized to create rooms.');
      return;
    }

    const code = inputP2PRoomCode.trim().toUpperCase();
    if (!code) return;

    if (p2pPassword.trim().toLowerCase() !== 'team9751') {
      showErrorMsg('Incorrect admin password.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSyncingP2P(true);

    try {
      await p2pSync.createRoom(code, p2pPassword.trim());
      showSuccessMsg(`Created & hosting P2P Room ${code}!`);
      setInputP2PRoomCode('');
      setP2pPassword('');
      await scanP2PRooms();
    } catch (err: any) {
      showErrorMsg(err.message || 'Failed to create P2P room.');
    } finally {
      setIsSyncingP2P(false);
    }
  };

  // Join P2P Room (no password required)
  const handleJoinP2PRoom = async (targetCode?: string) => {
    const code = (targetCode || inputP2PRoomCode).trim().toUpperCase();
    if (!code) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setConnectingP2PCode(code);
    setIsSyncingP2P(true);

    try {
      await p2pSync.joinRoom(code);
      showSuccessMsg(`Connected to P2P Room ${code}!`);
      setInputP2PRoomCode('');
      await scanP2PRooms();
    } catch (err: any) {
      showErrorMsg(err.message || 'Failed to connect. Check room code or ask host.');
    } finally {
      setIsSyncingP2P(false);
      setConnectingP2PCode(null);
    }
  };

  const handleLeaveP2PRoom = () => {
    p2pSync.disconnect();
    showSuccessMsg('Disconnected from P2P');
  };

  const handleDeleteP2PRoom = async (r: P2PAvailableRoom) => {
    if (!window.confirm(`Delete P2P room "${r.roomCode}"?`)) return;
    setDeletingP2PCode(r.roomCode);
    try {
      await p2pSync.deleteRoom(r.roomCode);
      showSuccessMsg('P2P room removed from list');
      await scanP2PRooms();
    } catch (err: any) {
      showErrorMsg(err.message || 'Failed to delete room.');
    } finally {
      setDeletingP2PCode(null);
    }
  };

  // --- CLOUD SYNC TRIGGER ---
  const handleCloudSync = async () => {
    if (!syncStatus.roomCode) {
      showErrorMsg('No active Cloud room. Please join or create a room first.');
      return;
    }

    setIsSyncingCloud(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await cloudSync.pushLocalDataToCloud();
      showSuccessMsg('Cloud Synced to Firebase');
      await loadCloudRooms();
    } catch (err: any) {
      showErrorMsg(err.message || 'Cloud sync failed.');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Create Cloud Room (only Kawser + password team9751)
  const handleCreateCloudRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isKawser) {
      showErrorMsg('Only Kawser is authorized to create rooms.');
      return;
    }

    const code = inputCloudRoomCode.trim().toUpperCase();
    if (!code) return;

    if (cloudPassword.trim().toLowerCase() !== 'team9751') {
      showErrorMsg('Incorrect admin password.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSyncingCloud(true);

    try {
      await cloudSync.createRoom(code, cloudPassword.trim());
      showSuccessMsg(`Created Cloud Room ${code}!`);
      setInputCloudRoomCode('');
      setCloudPassword('');
      await loadCloudRooms();
    } catch (err: any) {
      showErrorMsg(err.message || 'Failed to create Cloud room.');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Join Cloud Room (no password required)
  const handleJoinCloudRoom = async (targetCode: string) => {
    const code = targetCode.trim().toUpperCase();
    if (!code) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setConnectingCloudCode(code);
    setIsSyncingCloud(true);

    try {
      await cloudSync.joinRoom(code);
      showSuccessMsg(`Joined Cloud Room ${code}!`);
      setInputCloudRoomCode('');
      await loadCloudRooms();
    } catch (err: any) {
      showErrorMsg(err.message || 'Room not found. Check code or ask Kawser to create it.');
    } finally {
      setIsSyncingCloud(false);
      setConnectingCloudCode(null);
    }
  };

  const handleLeaveCloudRoom = () => {
    cloudSync.disconnect();
    showSuccessMsg('Disconnected from Cloud');
  };

  const handleDeleteCloudRoom = async (r: AvailableRoom) => {
    if (!window.confirm(`Delete room "${r.roomCode}"?`)) return;
    setDeletingRoomCode(r.roomCode);
    try {
      await cloudSync.deleteRoom(r.roomCode);
      showSuccessMsg('Room deleted');
      await loadCloudRooms();
    } catch (err: any) {
      showErrorMsg(err.message || 'Failed to delete room.');
    } finally {
      setDeletingRoomCode(null);
    }
  };

  // Compile active scouts in current Cloud room
  const currentCloudRoom = availableCloudRooms.find((r) => r.roomCode === syncStatus.roomCode);
  const cloudRoomScouts = currentCloudRoom?.connectedScouts || (currentCloudRoom?.creatorName ? [currentCloudRoom.creatorName] : []);

  // Filter Cloud rooms
  const filteredCloudRooms = availableCloudRooms.filter((r) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.roomCode.toLowerCase().includes(query) ||
      r.eventName.toLowerCase().includes(query) ||
      r.connectedScouts?.some((s) => s.toLowerCase().includes(query))
    );
  });

  // Filter P2P rooms
  const filteredP2PRooms = availableP2PRooms.filter((r) => {
    if (!p2pSearchQuery.trim()) return true;
    const query = p2pSearchQuery.toLowerCase();
    return (
      r.roomCode.toLowerCase().includes(query) ||
      r.creatorName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            {syncType === 'p2p' ? (
              <Radio className={`w-4 h-4 ${p2pStatus.isConnected ? 'text-emerald-400' : 'text-slate-400'}`} />
            ) : (
              <Cloud className={`w-4 h-4 ${syncStatus.roomCode ? 'text-blue-400' : 'text-slate-400'}`} />
            )}
            <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wide">
              Sync
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 overflow-y-auto space-y-3.5 text-xs font-mono">
          {/* Top Two Mode Buttons: P2P and Cloud */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSyncType('p2p')}
              className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                syncType === 'p2p'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>P2P</span>
              {p2pStatus.isConnected && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSyncType('cloud')}
              className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                syncType === 'cloud'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloud</span>
              {syncStatus.roomCode && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
              )}
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 flex items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="p-1 text-rose-400 hover:text-white rounded cursor-pointer shrink-0"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 flex items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="p-1 text-emerald-400 hover:text-white rounded cursor-pointer shrink-0"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ================= P2P TAB ================= */}
          {syncType === 'p2p' && (
            <div className="space-y-3">
              {/* Active Room Card */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${p2pStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      <span>{p2pStatus.isConnected ? (p2pStatus.isHost ? 'Host' : 'Connected') : 'Disconnected'}</span>
                    </div>
                    <div className="text-base font-black text-amber-300 mt-0.5">
                      {p2pStatus.roomCode || 'No Room'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleP2PSync}
                      disabled={isSyncingP2P}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingP2P ? 'animate-spin' : ''}`} />
                      <span>Sync</span>
                    </button>

                    {p2pStatus.isConnected && (
                      <button
                        type="button"
                        onClick={handleLeaveP2PRoom}
                        className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 cursor-pointer"
                        title="Leave"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Connected Scouts */}
                <div className="pt-2 border-t border-slate-900 space-y-1">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Users className="w-3 h-3 text-emerald-400" />
                    <span>Scouts ({p2pStatus.peers.length + (p2pStatus.isConnected ? 1 : 0)}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p2pStatus.isConnected && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                        <span>{scoutName || 'You'} (You)</span>
                        {p2pStatus.isHost && <span className="text-[9px] bg-emerald-800 px-1 rounded text-white">Host</span>}
                      </span>
                    )}
                    {p2pStatus.peers.map((peer, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-amber-300"
                      >
                        {peer.scoutName || `Scout #${idx + 1}`}
                      </span>
                    ))}
                    {!p2pStatus.isConnected && (
                      <span className="text-slate-500 text-[10px] italic">Not connected</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mode Selector: Create Room only shows for Kawser */}
              {isKawser ? (
                <div className="flex items-center gap-3 pt-1 border-t border-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setP2pMode('join');
                      setErrorMsg(null);
                    }}
                    className={`pb-1 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                      p2pMode === 'join'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Join Room
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setP2pMode('create');
                      setErrorMsg(null);
                    }}
                    className={`pb-1 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                      p2pMode === 'create'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Create Room
                  </button>
                </div>
              ) : (
                <div className="pt-1 border-t border-slate-900 text-[11px] font-bold text-slate-300">
                  Join Room
                </div>
              )}

              {/* Join P2P Form */}
              {(!isKawser || p2pMode === 'join') && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleJoinP2PRoom();
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    placeholder="Room Code"
                    value={inputP2PRoomCode}
                    onChange={(e) => setInputP2PRoomCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 uppercase focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!inputP2PRoomCode.trim() || isSyncingP2P}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Join
                  </button>
                </form>
              )}

              {/* Create P2P Form (Only for Kawser + Requires Password team9751) */}
              {isKawser && p2pMode === 'create' && (
                <form onSubmit={handleCreateP2PRoom} className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Room Code"
                    value={inputP2PRoomCode}
                    onChange={(e) => setInputP2PRoomCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 uppercase focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <KeyRound className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-500" />
                      <input
                        type={showP2pPassword ? "text" : "password"}
                        placeholder="Password"
                        value={p2pPassword}
                        onChange={(e) => setP2pPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-7 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowP2pPassword(!showP2pPassword)}
                        className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 cursor-pointer"
                        title={showP2pPassword ? "Hide password" : "Show password"}
                      >
                        {showP2pPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!inputP2PRoomCode.trim() || !p2pPassword.trim() || isSyncingP2P}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      Create
                    </button>
                  </div>
                </form>
              )}

              {/* Scan for Rooms / Available P2P Rooms List */}
              <div className="space-y-1.5 pt-1 border-t border-slate-900">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold flex items-center gap-1">
                    <Radar className="w-3 h-3 text-emerald-400" />
                    <span>Scan for Rooms:</span>
                  </span>
                  <button
                    type="button"
                    onClick={scanP2PRooms}
                    disabled={isLoadingP2PRooms}
                    className="text-emerald-400 hover:underline text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isLoadingP2PRooms ? 'animate-spin' : ''}`} />
                    <span>Scan</span>
                  </button>
                </div>

                {availableP2PRooms.length > 2 && (
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2 top-2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={p2pSearchQuery}
                      onChange={(e) => setP2pSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1 text-[11px] text-slate-300 placeholder-slate-500 focus:outline-none focus:border-slate-700"
                    />
                  </div>
                )}

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {filteredP2PRooms.length === 0 ? (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center text-slate-500 text-[11px]">
                      {isLoadingP2PRooms ? 'Scanning...' : 'No active P2P rooms found.'}
                    </div>
                  ) : (
                    filteredP2PRooms.map((r) => {
                      const isCurrent = p2pStatus.roomCode === r.roomCode;
                      const isTargetConnecting = connectingP2PCode === r.roomCode;
                      const isTargetDeleting = deletingP2PCode === r.roomCode;
                      const canDelete = isKawser;

                      return (
                        <div
                          key={r.roomCode}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                            isCurrent
                              ? 'bg-emerald-950/30 border-emerald-800/80'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="truncate">
                            <div className="font-bold text-white text-[11px] flex items-center gap-1.5">
                              <span>{r.roomCode}</span>
                              {isCurrent && (
                                <span className="text-[9px] text-emerald-400 px-1 rounded bg-emerald-950 border border-emerald-800">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              Host: {r.creatorName}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteP2PRoom(r)}
                                disabled={isTargetDeleting}
                                className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            {!isCurrent && (
                              <button
                                type="button"
                                onClick={() => handleJoinP2PRoom(r.roomCode)}
                                disabled={isSyncingP2P}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold cursor-pointer disabled:opacity-50 flex items-center gap-0.5"
                              >
                                <span>{isTargetConnecting ? '...' : 'Join'}</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Scout Name */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">
                <span className="text-slate-400">Scout Name:</span>
                <input
                  type="text"
                  value={scoutName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScoutName(val);
                    p2pSync.setScoutName(val);
                    cloudSync.setScoutName(val);
                    if (val.trim().toLowerCase() !== 'kawser') {
                      setP2pMode('join');
                      setCloudMode('join');
                    }
                  }}
                  placeholder="Your Name"
                  className="w-36 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-right focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* ================= CLOUD TAB ================= */}
          {syncType === 'cloud' && (
            <div className="space-y-3">
              {/* Active Room Card */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${syncStatus.roomCode ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
                      <span>{syncStatus.roomCode ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div className="text-base font-black text-amber-300 mt-0.5">
                      {syncStatus.roomCode || 'No Room'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCloudSync}
                      disabled={isSyncingCloud}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                      <span>Sync</span>
                    </button>

                    {syncStatus.roomCode && (
                      <button
                        type="button"
                        onClick={handleLeaveCloudRoom}
                        className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 cursor-pointer"
                        title="Leave"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Connected Scouts */}
                {syncStatus.roomCode && (
                  <div className="pt-2 border-t border-slate-900 space-y-1">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3 text-blue-400" />
                      <span>Scouts ({cloudRoomScouts.length || 1}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cloudRoomScouts.length === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800 text-[10px] text-blue-300">
                          {scoutName || 'You'} (You)
                        </span>
                      ) : (
                        cloudRoomScouts.map((scout, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded border text-[10px] ${
                              scout === scoutName
                                ? 'bg-blue-950/80 border-blue-800 text-blue-300'
                                : 'bg-slate-900 border-slate-800 text-slate-300'
                            }`}
                          >
                            {scout}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Mode Selector: Create Room only shows for Kawser */}
              {isKawser ? (
                <div className="flex items-center gap-3 pt-1 border-t border-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setCloudMode('join');
                      setErrorMsg(null);
                    }}
                    className={`pb-1 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                      cloudMode === 'join'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Join Room
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCloudMode('create');
                      setErrorMsg(null);
                    }}
                    className={`pb-1 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                      cloudMode === 'create'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Create Room
                  </button>
                </div>
              ) : (
                <div className="pt-1 border-t border-slate-900 text-[11px] font-bold text-slate-300">
                  Join Room
                </div>
              )}

              {/* Join Cloud Room Form */}
              {(!isKawser || cloudMode === 'join') && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleJoinCloudRoom(inputCloudRoomCode);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    placeholder="Room Code"
                    value={inputCloudRoomCode}
                    onChange={(e) => setInputCloudRoomCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 uppercase focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!inputCloudRoomCode.trim() || isSyncingCloud}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Join
                  </button>
                </form>
              )}

              {/* Create Cloud Room Form (Only for Kawser + Requires Password team9751) */}
              {isKawser && cloudMode === 'create' && (
                <form onSubmit={handleCreateCloudRoom} className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Room Code"
                    value={inputCloudRoomCode}
                    onChange={(e) => setInputCloudRoomCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 uppercase focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <KeyRound className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-500" />
                      <input
                        type={showCloudPassword ? "text" : "password"}
                        placeholder="Password"
                        value={cloudPassword}
                        onChange={(e) => setCloudPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-7 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCloudPassword(!showCloudPassword)}
                        className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 cursor-pointer"
                        title={showCloudPassword ? "Hide password" : "Show password"}
                      >
                        {showCloudPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!inputCloudRoomCode.trim() || !cloudPassword.trim() || isSyncingCloud}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      Create
                    </button>
                  </div>
                </form>
              )}

              {/* Scan for Rooms / Available Rooms List */}
              <div className="space-y-1.5 pt-1 border-t border-slate-900">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold flex items-center gap-1">
                    <Radar className="w-3 h-3 text-blue-400" />
                    <span>Scan for Rooms:</span>
                  </span>
                  <button
                    type="button"
                    onClick={loadCloudRooms}
                    disabled={isLoadingRooms}
                    className="text-blue-400 hover:underline text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isLoadingRooms ? 'animate-spin' : ''}`} />
                    <span>Scan</span>
                  </button>
                </div>

                {availableCloudRooms.length > 2 && (
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2 top-2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1 text-[11px] text-slate-300 placeholder-slate-500 focus:outline-none focus:border-slate-700"
                    />
                  </div>
                )}

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {filteredCloudRooms.length === 0 ? (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center text-slate-500 text-[11px]">
                      {isLoadingRooms ? 'Scanning...' : 'No rooms found.'}
                    </div>
                  ) : (
                    filteredCloudRooms.map((r) => {
                      const isCurrent = syncStatus.roomCode === r.roomCode;
                      const isTargetConnecting = connectingCloudCode === r.roomCode;
                      const isTargetDeleting = deletingRoomCode === r.roomCode;
                      const canDelete = isKawser || cloudSync.isRoomCreator(r);
                      const scoutsList = r.connectedScouts || (r.creatorName ? [r.creatorName] : []);

                      return (
                        <div
                          key={r.roomCode}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                            isCurrent
                              ? 'bg-blue-950/30 border-blue-800/80'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="truncate">
                            <div className="font-bold text-white text-[11px] flex items-center gap-1.5">
                              <span>{r.roomCode}</span>
                              {isCurrent && (
                                <span className="text-[9px] text-blue-400 px-1 rounded bg-blue-950 border border-blue-800">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {scoutsList.length > 0 ? scoutsList.join(', ') : 'No scouts'}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCloudRoom(r)}
                                disabled={isTargetDeleting}
                                className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            {!isCurrent && (
                              <button
                                type="button"
                                onClick={() => handleJoinCloudRoom(r.roomCode)}
                                disabled={isSyncingCloud}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold cursor-pointer disabled:opacity-50 flex items-center gap-0.5"
                              >
                                <span>{isTargetConnecting ? '...' : 'Join'}</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Scout Name */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">
                <span className="text-slate-400">Scout Name:</span>
                <input
                  type="text"
                  value={scoutName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScoutName(val);
                    p2pSync.setScoutName(val);
                    cloudSync.setScoutName(val);
                    if (val.trim().toLowerCase() !== 'kawser') {
                      setP2pMode('join');
                      setCloudMode('join');
                    }
                  }}
                  placeholder="Your Name"
                  className="w-36 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-right focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
