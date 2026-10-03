import React, { useState, useEffect } from 'react';
import { 
  cloudSync, 
  SyncStatus,
  AvailableRoom
} from '../../db/cloudSync';
import { 
  Cloud, 
  RefreshCw, 
  Check, 
  Copy, 
  Users, 
  ShieldCheck, 
  Zap, 
  X, 
  Radio, 
  LogOut,
  Search,
  Sparkles,
  Layers,
  Clock,
  ArrowRight,
  Plus
} from 'lucide-react';

interface TeamRoomSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamRoomSyncModal: React.FC<TeamRoomSyncModalProps> = ({ isOpen, onClose }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(cloudSync.getStatus());
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [eventNameInput, setEventNameInput] = useState('FRC REBUILT Competition');
  const [scoutNameInput, setScoutNameInput] = useState(cloudSync.getScoutName());
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Available Rooms Discovery & Search State
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'custom'>('browse');

  useEffect(() => {
    const unsub = cloudSync.subscribe((status) => {
      setSyncStatus(status);
      if (status.roomCode) {
        setRoomCodeInput(status.roomCode);
        setEventNameInput(status.eventName);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadRooms();
    }
  }, [isOpen]);

  const loadRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const list = await cloudSync.fetchAvailableRooms();
      setAvailableRooms(list);
    } catch {
      // safe fallback
    } finally {
      setIsLoadingRooms(false);
    }
  };

  if (!isOpen) return null;

  const handleConnectToCode = async (targetCode: string, targetEvent?: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanCode = targetCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('Please enter a team room code (e.g. 9751-SVR)');
      return;
    }

    if (scoutNameInput.trim()) {
      cloudSync.setScoutName(scoutNameInput.trim());
    }

    setIsConnecting(true);
    try {
      await cloudSync.connectToRoom(cleanCode, targetEvent || eventNameInput);
      setSuccessMsg(`Successfully connected to Room: ${cleanCode}`);
      await loadRooms();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to cloud room.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleConnectToCode(roomCodeInput, eventNameInput);
  };

  const handleManualSync = async () => {
    setErrorMsg(null);
    setIsConnecting(true);
    try {
      await cloudSync.pushLocalDataToCloud();
      setSuccessMsg('Pushed local data and fetched latest cloud updates.');
      await loadRooms();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Sync failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    cloudSync.disconnect();
    setRoomCodeInput('');
    setSuccessMsg('Disconnected from room.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleCopyInvite = () => {
    if (!syncStatus.roomCode) return;
    navigator.clipboard.writeText(syncStatus.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredRooms = availableRooms.filter((r) => {
    if (!roomSearchQuery.trim()) return true;
    const q = roomSearchQuery.toLowerCase();
    return r.roomCode.toLowerCase().includes(q) || r.eventName.toLowerCase().includes(q);
  });

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return 'Recently';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              syncStatus.roomCode 
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' 
                : 'bg-blue-950/60 border-blue-800 text-blue-400'
            }`}>
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
                Team Cloud Auto-Sync
                {syncStatus.roomCode && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 border border-emerald-800/80 text-emerald-300 font-sans font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                Sync scouts remotely in real-time across the competition arena
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <span className="font-bold">Error:</span> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ACTIVE ROOM STATUS (if already connected) */}
          {syncStatus.roomCode && (
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>CONNECTED TO ROOM</span>
                  </div>
                  <div className="text-xl font-black text-emerald-300 font-mono tracking-wider mt-0.5">
                    {syncStatus.roomCode}
                  </div>
                  <div className="text-xs text-slate-300">{syncStatus.eventName}</div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Scout Name</div>
                  <div className="font-bold text-slate-200 truncate">{syncStatus.scoutName}</div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Last Sync</div>
                  <div className="font-bold text-slate-200">
                    {syncStatus.lastSyncedAt 
                      ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : 'Just now'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isConnecting}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          )}

          {/* Scout Name Configuration (Always visible) */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Scout Name:</span>
              <input
                type="text"
                value={scoutNameInput}
                onChange={(e) => {
                  setScoutNameInput(e.target.value);
                  cloudSync.setScoutName(e.target.value);
                }}
                placeholder="Your Name (e.g. Alex)"
                className="bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-amber-400 w-36 sm:w-48 font-mono"
              />
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:inline font-mono">Attached to scouting records</span>
          </div>

          {/* Navigation Tabs: Browse Available Rooms vs Join/Create by Code */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === 'browse'
                  ? 'bg-slate-800 text-amber-300 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Available Rooms ({availableRooms.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-slate-800 text-amber-300 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Join or Create by Code</span>
            </button>
          </div>

          {/* TAB 1: BROWSE & SEARCH AVAILABLE ROOMS */}
          {activeTab === 'browse' && (
            <div className="space-y-3">
              {/* Search Bar & Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search room code or event name..."
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8.5 pr-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadRooms}
                  disabled={isLoadingRooms}
                  className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Refresh room list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRooms ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>

              {/* Rooms List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {isLoadingRooms ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-400" />
                    <p className="text-xs font-mono">Discovering active scouting rooms...</p>
                  </div>
                ) : filteredRooms.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                    <Radio className="w-6 h-6 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-mono">
                      {roomSearchQuery ? 'No rooms match your search query.' : 'No active cloud rooms detected yet.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('custom')}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 hover:underline cursor-pointer"
                    >
                      <span>Create the first room</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  filteredRooms.map((room) => {
                    const isCurrent = syncStatus.roomCode === room.roomCode;
                    return (
                      <div
                        key={room.roomCode}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-emerald-950/30 border-emerald-800/80 shadow-sm'
                            : 'bg-slate-950/80 hover:bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-slate-100 tracking-tight">
                              {room.roomCode}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-[10px] text-emerald-300 font-mono font-bold">
                                Connected
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                            {room.eventName}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatRelativeTime(room.lastActiveAt || room.createdAt)}</span>
                            </span>
                            {typeof room.teamCount === 'number' && room.teamCount > 0 && (
                              <span>• {room.teamCount} teams</span>
                            )}
                            {typeof room.matchCount === 'number' && room.matchCount > 0 && (
                              <span>• {room.matchCount} matches</span>
                            )}
                          </div>
                        </div>

                        <div>
                          {isCurrent ? (
                            <span className="px-3 py-1.5 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-xs font-mono font-bold">
                              Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleConnectToCode(room.roomCode, room.eventName)}
                              disabled={isConnecting}
                              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold transition-colors cursor-pointer shadow disabled:opacity-50"
                            >
                              Join
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: JOIN OR CREATE CUSTOM ROOM CODE */}
          {activeTab === 'custom' && (
            <form onSubmit={handleManualSubmit} className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400" />
                <span>Enter Room Code to Join or Create</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-mono">
                  Team Room Code (e.g. 9751-SVR, 254-CMP, TEAM-ROOM)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9751-SVR"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-mono">
                  Event / Competition Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Silicon Valley Regional"
                  value={eventNameInput}
                  onChange={(e) => setEventNameInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 shadow-md"
              >
                <Zap className="w-3.5 h-3.5 text-slate-950" />
                <span>{isConnecting ? 'Connecting...' : 'Connect / Create Room'}</span>
              </button>
            </form>
          )}

          {/* HOW CONFLICT RESOLUTION WORKS */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs font-mono">
            <div className="font-bold text-slate-300 flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Real-Time Cloud Synchronization Features</span>
            </div>
            
            <div className="text-[10px] text-slate-400 leading-relaxed space-y-1">
              <p>• <strong>Instant Live Push</strong>: Every match and pit observation is automatically synced to all scouts connected to the same room code.</p>
              <p>• <strong>Full Offline Buffer</strong>: When arena cellular drops, changes queue locally in IndexedDB and upload immediately when reconnected.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px] font-mono">FRC Real-Time Firestore Sync</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
