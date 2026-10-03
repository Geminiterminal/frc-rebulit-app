import React, { useState, useEffect } from 'react';
import { MatchScoutingRecord } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { 
  Plus, 
  Minus, 
  Save, 
  ArrowLeft, 
  Check, 
  ShieldAlert, 
  Star, 
  CheckCircle2 
} from 'lucide-react';

interface MatchScoutFormProps {
  initialTeamNumber?: number;
  initialMatchNumber?: number;
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const MatchScoutForm: React.FC<MatchScoutFormProps> = ({
  initialTeamNumber,
  initialMatchNumber = 1,
  onNavigate,
}) => {
  const [matchNumber, setMatchNumber] = useState<number>(initialMatchNumber);
  const [teamNumber, setTeamNumber] = useState<string>(
    initialTeamNumber ? initialTeamNumber.toString() : ''
  );
  const [matchType, setMatchType] = useState<'Qualification' | 'Playoff' | 'Practice'>('Qualification');
  const [alliance, setAlliance] = useState<'RED' | 'BLUE'>('BLUE');
  const [scoutName, setScoutName] = useState<string>('');

  const [preloadBalls, setPreloadBalls] = useState<number>(0);
  const [startPosition, setStartPosition] = useState<'Left' | 'Center' | 'Right'>('Center');

  const [autoMobility, setAutoMobility] = useState<boolean>(false);
  const [autoHighScored, setAutoHighScored] = useState<number>(0);
  const [autoLowScored, setAutoLowScored] = useState<number>(0);
  const [autoMissed, setAutoMissed] = useState<number>(0);

  const [teleopHighScored, setTeleopHighScored] = useState<number>(0);
  const [teleopLowScored, setTeleopLowScored] = useState<number>(0);
  const [teleopMissed, setTeleopMissed] = useState<number>(0);
  const [usedTrench, setUsedTrench] = useState<boolean>(false);
  const [usedBump, setUsedBump] = useState<boolean>(false);
  const [defensePlayed, setDefensePlayed] = useState<'None' | 'Effective' | 'Ineffective'>('None');

  const [hangStatus, setHangStatus] = useState<'None' | 'Parked' | 'Level Climb' | 'Tilted Climb' | 'Failed'>('None');
  const [climbSpeed, setClimbSpeed] = useState<'Fast (<5s)' | 'Medium (5-15s)' | 'Slow (>15s)' | 'N/A'>('N/A');

  const [robotBroke, setRobotBroke] = useState<boolean>(false);
  const [breakDetails, setBreakDetails] = useState<string>('');
  const [cards, setCards] = useState<'None' | 'Yellow' | 'Red'>('None');
  const [overallRating, setOverallRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    scoutingDB.getSetting<string>('scoutName', '').then((name) => {
      if (name) setScoutName(name);
    });

    if (!initialMatchNumber) {
      scoutingDB.getAllMatches().then((matches) => {
        if (matches.length > 0) {
          const maxMatch = Math.max(...matches.map((m) => m.matchNumber));
          setMatchNumber(maxMatch + 1);
        }
      });
    }
  }, [initialMatchNumber]);

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const teamNum = parseInt(teamNumber, 10);
    if (isNaN(teamNum) || teamNum <= 0) return;

    const record: MatchScoutingRecord = {
      id: `match-m${matchNumber}-t${teamNum}-${Date.now()}`,
      teamNumber: teamNum,
      matchNumber,
      matchType,
      alliance,
      scoutName: scoutName || 'Scout',
      timestamp: Date.now(),
      preloadBalls,
      startPosition,
      autoMobility,
      autoHighScored,
      autoLowScored,
      autoMissed,
      teleopHighScored,
      teleopLowScored,
      teleopMissed,
      usedTrench,
      usedBump,
      defensePlayed,
      hangStatus,
      climbSpeed,
      robotBroke,
      breakDetails: robotBroke ? breakDetails : undefined,
      cards,
      overallRating,
      notes,
    };

    await scoutingDB.saveMatch(record);

    const existingTeam = await scoutingDB.getTeam(teamNum);
    if (!existingTeam) {
      await scoutingDB.saveTeam({
        teamNumber: teamNum,
        teamName: `Team ${teamNum}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    if (scoutName) {
      await scoutingDB.setSetting('scoutName', scoutName);
    }

    setToastMessage(`Match ${matchNumber} saved`);

    setTimeout(() => {
      setToastMessage(null);
      setMatchNumber((prev) => prev + 1);
      setTeamNumber('');
      setAutoHighScored(0);
      setAutoLowScored(0);
      setAutoMissed(0);
      setTeleopHighScored(0);
      setTeleopLowScored(0);
      setTeleopMissed(0);
      setUsedTrench(false);
      setUsedBump(false);
      setDefensePlayed('None');
      setHangStatus('None');
      setClimbSpeed('N/A');
      setRobotBroke(false);
      setBreakDetails('');
      setNotes('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1000);
  };

  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 pb-24 flex flex-col gap-3">
      {/* Top Header */}
      <div className="sticky top-13 z-30 bg-slate-950/95 backdrop-blur-md -mx-3 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-sm font-bold font-mono text-slate-200">
            MATCH {matchNumber} {teamNumber && `• Team ${teamNumber}`}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveMatch}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs uppercase shadow transition-colors active:scale-95 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
      </div>

      {/* MATCH & TEAM IDENTIFICATION */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Match Number */}
          <div>
            <span className="block text-[10px] font-mono font-semibold uppercase text-slate-400 mb-1">
              Match #
            </span>
            <input
              type="number"
              min="1"
              required
              value={matchNumber}
              onChange={(e) => setMatchNumber(parseInt(e.target.value, 10) || 1)}
              className="w-full text-center text-base font-mono font-bold bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-slate-100 focus:outline-none"
            />
          </div>

          {/* Team Number */}
          <div>
            <span className="block text-[10px] font-mono font-semibold uppercase text-slate-400 mb-1">
              Team #
            </span>
            <input
              type="number"
              required
              placeholder="9751"
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value)}
              className="w-full text-center text-base font-mono font-bold bg-slate-950 border border-slate-750 rounded-lg py-1.5 px-2 text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>

          {/* Alliance Switcher */}
          <div className="col-span-2">
            <span className="block text-[10px] font-mono font-semibold uppercase text-slate-400 mb-1">
              Alliance
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setAlliance('BLUE')}
                className={`py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                  alliance === 'BLUE'
                    ? 'bg-slate-800 text-blue-300 border border-blue-700/80 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                Blue
              </button>
              <button
                type="button"
                onClick={() => setAlliance('RED')}
                className={`py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                  alliance === 'RED'
                    ? 'bg-slate-800 text-rose-300 border border-rose-700/80 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                Red
              </button>
            </div>
          </div>
        </div>

        {/* Scout Name */}
        <input
          type="text"
          placeholder="Scout Name (Optional)"
          value={scoutName}
          onChange={(e) => setScoutName(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
        />
      </div>

      {/* PHASE 1: PRE-MATCH */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <span className="text-xs font-semibold text-slate-200 block">
          Pre-Match
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="flex gap-1">
              {(['Left', 'Center', 'Right'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setStartPosition(pos)}
                  className={`flex-1 py-1.5 rounded-md font-medium text-xs transition-colors ${
                    startPosition === pos
                      ? 'bg-slate-800 text-slate-100 border border-slate-600'
                      : 'bg-slate-950 text-slate-400 border border-slate-850'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPreloadBalls(num)}
                  className={`flex-1 py-1.5 rounded-md font-mono text-xs font-semibold transition-colors ${
                    preloadBalls === num
                      ? 'bg-slate-800 text-slate-100 border border-slate-600'
                      : 'bg-slate-950 text-slate-400 border border-slate-850'
                  }`}
                >
                  {num}b
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PHASE 2: AUTONOMOUS */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider">
            Autonomous
          </span>
          <button
            type="button"
            onClick={() => setAutoMobility(!autoMobility)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              autoMobility
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'bg-slate-950 text-slate-400 border border-slate-850'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Crossed Line</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Auto High Scored */}
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">High Hub</div>
              <div className="text-2xl font-mono font-bold text-slate-100 mt-0.5">
                {autoHighScored}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAutoHighScored(Math.max(0, autoHighScored - 1))}
                className="w-9 h-9 rounded-md bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex items-center justify-center font-bold active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setAutoHighScored(autoHighScored + 1)}
                className="w-11 h-9 rounded-md bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 flex items-center justify-center font-bold active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Auto Low Scored */}
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Low Hub</div>
              <div className="text-2xl font-mono font-bold text-slate-200 mt-0.5">
                {autoLowScored}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAutoLowScored(Math.max(0, autoLowScored - 1))}
                className="w-9 h-9 rounded-md bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex items-center justify-center font-bold active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setAutoLowScored(autoLowScored + 1)}
                className="w-11 h-9 rounded-md bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 flex items-center justify-center font-bold active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Auto Missed Counter */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950 rounded-lg border border-slate-800/80 text-xs">
          <span className="text-slate-400">Missed:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoMissed(Math.max(0, autoMissed - 1))}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono font-bold text-slate-300 w-5 text-center">
              {autoMissed}
            </span>
            <button
              type="button"
              onClick={() => setAutoMissed(autoMissed + 1)}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* PHASE 3: TELEOP */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
        <span className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider block">
          Teleop
        </span>

        <div className="grid grid-cols-2 gap-2">
          {/* Teleop High Hub */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">High Hub (2pt)</div>
              <div className="text-3xl font-mono font-bold text-slate-100 mt-0.5">
                {teleopHighScored}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTeleopHighScored(Math.max(0, teleopHighScored - 1))}
                className="w-10 h-10 rounded-md bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex items-center justify-center font-bold active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTeleopHighScored(teleopHighScored + 1)}
                className="w-13 h-10 rounded-md bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 flex items-center justify-center font-bold active:scale-95 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Teleop Low Hub */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Low Hub (1pt)</div>
              <div className="text-3xl font-mono font-bold text-slate-200 mt-0.5">
                {teleopLowScored}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTeleopLowScored(Math.max(0, teleopLowScored - 1))}
                className="w-10 h-10 rounded-md bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex items-center justify-center font-bold active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTeleopLowScored(teleopLowScored + 1)}
                className="w-13 h-10 rounded-md bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 flex items-center justify-center font-bold active:scale-95 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Traversal Observed */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setUsedTrench(!usedTrench)}
            className={`py-1.5 px-2 rounded-md font-medium transition-colors ${
              usedTrench
                ? 'bg-slate-800 text-slate-100 border border-slate-600'
                : 'bg-slate-950 text-slate-400 border border-slate-850'
            }`}
          >
            {usedTrench ? '✓ Trench' : 'Trench'}
          </button>
          <button
            type="button"
            onClick={() => setUsedBump(!usedBump)}
            className={`py-1.5 px-2 rounded-md font-medium transition-colors ${
              usedBump
                ? 'bg-slate-800 text-slate-100 border border-slate-600'
                : 'bg-slate-950 text-slate-400 border border-slate-850'
            }`}
          >
            {usedBump ? '✓ Bump' : 'Bump'}
          </button>
        </div>
      </div>

      {/* PHASE 4: ENDGAME */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <span className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider block">
          Endgame (Climb)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(['None', 'Parked', 'Level Climb', 'Tilted Climb', 'Failed'] as const).map((status) => {
            const isSelected = hangStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setHangStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>

      {/* PHASE 5: POST-MATCH EVALUATION */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setRobotBroke(!robotBroke)}
            className={`py-2 px-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 ${
              robotBroke
                ? 'bg-slate-800 text-rose-300 border border-rose-700/80'
                : 'bg-slate-950 text-slate-400 border border-slate-850'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{robotBroke ? 'Robot Broke' : 'No Breakdowns'}</span>
          </button>

          <div className="flex items-center justify-center gap-0.5 bg-slate-950 border border-slate-850 rounded-lg px-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setOverallRating(star)}
                className="p-1"
              >
                <Star
                  className={`w-4 h-4 ${
                    star <= overallRating ? 'text-amber-400/90 fill-amber-400/90' : 'text-slate-700'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {robotBroke && (
          <input
            type="text"
            value={breakDetails}
            onChange={(e) => setBreakDetails(e.target.value)}
            placeholder="Break details..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
          />
        )}

        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Brief match notes..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-none"
        />
      </div>

      {/* SAVE MATCH BUTTON */}
      <button
        type="button"
        onClick={handleSaveMatch}
        className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer active:scale-95"
      >
        Save Match {matchNumber}
      </button>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs px-4 py-2 rounded-lg shadow-xl flex items-center gap-1.5 animate-bounce">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
