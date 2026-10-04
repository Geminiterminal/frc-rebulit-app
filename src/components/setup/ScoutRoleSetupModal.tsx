import React, { useState } from 'react';
import { 
  Crown, 
  Target, 
  Zap, 
  BarChart3, 
  Wrench, 
  ShieldCheck, 
  Check, 
  X, 
  Lock, 
  User, 
  AlertCircle
} from 'lucide-react';
import { 
  scoutingAssignments, 
  ScoutPosition, 
  SCOUT_POSITIONS, 
  ScoutProfile 
} from '../../db/scoutingAssignments';

interface ScoutRoleSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (profile: ScoutProfile) => void;
  isInitialSetup?: boolean;
}

export function ScoutRoleSetupModal({
  isOpen,
  onClose,
  onSaved,
  isInitialSetup = false,
}: ScoutRoleSetupModalProps) {
  const currentProfile = scoutingAssignments.getProfile();
  const [name, setName] = useState<string>(currentProfile.name || '');
  const [selectedPosition, setSelectedPosition] = useState<ScoutPosition>(currentProfile.position);
  const [passcode, setPasscode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Please enter your scout name.');
      return;
    }

    if (selectedPosition === 'LEAD_SCOUT') {
      const isAlreadyLead = currentProfile.position === 'LEAD_SCOUT';
      if (!isAlreadyLead && passcode.trim() !== 'team9751' && cleanName.toLowerCase() !== 'kawser') {
        setErrorMsg('Passcode required for Lead Scout (team9751).');
        return;
      }
    }

    const saved = scoutingAssignments.setProfile({
      name: cleanName,
      position: selectedPosition,
      isSetupComplete: true,
    });

    if (onSaved) onSaved(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-4 shadow-xl space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Scout Profile & Role
            </h3>
          </div>

          {!isInitialSetup && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Scout Name Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              <span>Name / Callsign</span>
            </label>
            <input
              type="text"
              placeholder="Kawser, Alex, Maya"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium"
              required
            />
          </div>

          {/* Position Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300">
              Position
            </label>

            <div className="grid grid-cols-1 gap-1.5">
              {SCOUT_POSITIONS.map((pos) => {
                const isSelected = selectedPosition === pos.id;
                return (
                  <div
                    key={pos.id}
                    onClick={() => {
                      setSelectedPosition(pos.id);
                      setErrorMsg(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-cyan-500 text-white font-bold'
                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {pos.id === 'LEAD_SCOUT' ? <Crown className="w-3.5 h-3.5 text-amber-400" /> :
                       pos.id === 'PIT_SCOUT' ? <Target className="w-3.5 h-3.5 text-cyan-400" /> :
                       pos.id === 'MATCH_SCOUT' ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> :
                       pos.id === 'STRATEGIST' ? <BarChart3 className="w-3.5 h-3.5 text-indigo-400" /> :
                       <Wrench className="w-3.5 h-3.5 text-orange-400" />}
                      <span>{pos.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Passcode if selecting Lead Scout */}
          {selectedPosition === 'LEAD_SCOUT' && currentProfile.position !== 'LEAD_SCOUT' && name.trim().toLowerCase() !== 'kawser' && (
            <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 space-y-1">
              <label className="text-[10px] font-semibold text-amber-300 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Passcode (team9751)</span>
              </label>
              <input
                type="password"
                placeholder="Enter passcode..."
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-slate-950 border border-amber-700/80 rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
