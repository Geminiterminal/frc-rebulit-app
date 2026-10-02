import React, { useState, useEffect } from 'react';
import { 
  cloudSync, 
  SyncStatus 
} from '../../db/cloudSync';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  Copy, 
  Users, 
  ShieldCheck, 
  Zap, 
  X, 
  Layers, 
  Radio, 
  Wifi, 
  ArrowRight,
  LogOut
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

  if (!isOpen) return null;

  const handleJoinOrCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!roomCodeInput.trim()) {
      setErrorMsg('Please enter a team room code (e.g. 9751-SVR)');
      return;
    }

    if (scoutNameInput.trim()) {
      cloudSync.setScoutName(scoutNameInput.trim());
    }

    setIsConnecting(true);
    try {
      await cloudSync.connectToRoom(roomCodeInput, eventNameInput);
      setSuccessMsg(`Successfully connected to Room: ${roomCodeInput.trim().toUpperCase()}`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to cloud room.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualSync = async () => {
    setErrorMsg(null);
    setIsConnecting(true);
    try {
      await cloudSync.pushLocalDataToCloud();
      setSuccessMsg('Pushed local data and fetched latest cloud updates.');
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
    const text = `Join FRC Scouting Room: ${syncStatus.roomCode} for ${syncStatus.eventName}`;
    navigator.clipboard.writeText(syncStatus.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
                Sync scouts remotely without QR codes or meeting face-to-face
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <span className="font-bold">Error:</span> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ACTIVE ROOM STATUS */}
          {syncStatus.roomCode ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">
                    CONNECTED TEAM ROOM
                  </div>
                  <div className="text-lg font-black text-emerald-400 font-mono tracking-wider">
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

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Scout Name</div>
                  <div className="font-bold text-slate-200 font-mono">{syncStatus.scoutName}</div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Last Cloud Sync</div>
                  <div className="font-bold text-slate-200 font-mono">
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
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave</span>
                </button>
              </div>
            </div>
          ) : (
            /* JOIN OR CREATE ROOM FORM */
            <form onSubmit={handleJoinOrCreate} className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-400" />
                <span>Join or Create a Team Sync Room</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Team Room Code (Share this with all your scouts)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9751-SVR or TEAM-9751"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Your Scout Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    value={scoutNameInput}
                    onChange={(e) => setScoutNameInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Competition / Event
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Silicon Valley Regional"
                    value={eventNameInput}
                    onChange={(e) => setEventNameInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-md"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isConnecting ? 'Connecting...' : 'Connect to Team Room'}</span>
              </button>
            </form>
          )}

          {/* HOW CONFLICT RESOLUTION WORKS */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Smart Conflict Resolution Engine</span>
            </div>
            
            <div className="space-y-1.5 text-[11px] text-slate-400 leading-relaxed">
              <p>
                • <strong>Matches (Append-Only)</strong>: Each scout's observation has a unique log ID. If multiple scouts scout the same match, both observations are stored and aggregated (averaging cycle times, accuracy, scoring) with zero data loss.
              </p>
              <p>
                • <strong>Pit Specs (Field-Level LWW)</strong>: Robot specifications merge per-field based on newest timestamp, preventing scouts from accidentally wiping out each other's notes.
              </p>
              <p>
                • <strong>Offline Resilience</strong>: If cellular drops in the arena, submissions are queued locally in IndexedDB and sent automatically the second connection returns.
              </p>
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
