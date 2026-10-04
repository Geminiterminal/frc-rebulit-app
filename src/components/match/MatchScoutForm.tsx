import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  MatchScoutingRecord, 
  FieldRouteType, 
  DefenseEffectivenessType, 
  RobotIssuesType 
} from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { scoutingAssignments } from '../../db/scoutingAssignments';
import { qrTransferEngine } from '../../utils/qrTransferEngine';
import { 
  Save, 
  ArrowLeft, 
  Check, 
  CheckCircle2,
  AlertTriangle,
  Zap,
  Target,
  Route,
  Shield,
  MessageSquare,
  QrCode,
  X
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
  // MATCH IDENTIFICATION
  const [matchNumber, setMatchNumber] = useState<number>(initialMatchNumber);
  const [teamNumber, setTeamNumber] = useState<string>(
    initialTeamNumber ? initialTeamNumber.toString() : ''
  );

  // 1. AUTONOMOUS (Starts unselected / blank)
  const [autoWorked, setAutoWorked] = useState<boolean | null>(null);
  const [autoFuelScored, setAutoFuelScored] = useState<number>(0);

  // 2. SCORING
  const [teleopFuelScored, setTeleopFuelScored] = useState<number>(0);

  // 3. FIELD ROUTE (Starts unselected / blank)
  const [fieldRoute, setFieldRoute] = useState<FieldRouteType | null>(null);

  // 4. DEFENSE (Starts unselected / blank)
  const [playedDefense, setPlayedDefense] = useState<boolean | null>(null);
  const [defenseEffectiveness, setDefenseEffectiveness] = useState<DefenseEffectivenessType | null>(null);

  // 5. ROBOT RELIABILITY (Starts unselected / blank)
  const [robotIssues, setRobotIssues] = useState<RobotIssuesType | null>(null);
  const [whatHappenedNote, setWhatHappenedNote] = useState<string>('');

  // 6. QUICK OBSERVATION
  const [quickNote, setQuickNote] = useState<string>('');
  const [impression, setImpression] = useState<number | null>(null);

  // UI state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSingleQrOpen, setIsSingleQrOpen] = useState<boolean>(false);
  const [singleQrUrl, setSingleQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!initialMatchNumber) {
      scoutingDB.getAllMatches().then((matches) => {
        if (matches.length > 0) {
          const maxMatch = Math.max(...matches.map((m) => m.matchNumber));
          setMatchNumber(maxMatch + 1);
        }
      });
    }
  }, [initialMatchNumber]);

  // Load existing match scout record if present in IndexedDB
  useEffect(() => {
    const teamNum = parseInt(teamNumber, 10);
    if (!isNaN(teamNum) && teamNum > 0 && matchNumber > 0) {
      scoutingDB.getMatchesForTeam(teamNum).then((records) => {
        const existing = records.find((r) => r.matchNumber === matchNumber);
        if (existing) {
          setAutoWorked(existing.autoWorked);
          setAutoFuelScored(existing.autoFuelScored || existing.autoHighScored || 0);
          setTeleopFuelScored(existing.teleopFuelScored || existing.teleopHighScored || 0);
          setFieldRoute(existing.fieldRoute || null);
          setPlayedDefense(existing.playedDefense);
          setDefenseEffectiveness(existing.defenseEffectiveness || null);
          setRobotIssues(existing.robotIssues || null);
          setWhatHappenedNote(existing.whatHappenedNote || '');
          setQuickNote(existing.quickNote || existing.notes || '');
        } else {
          setAutoWorked(null);
          setAutoFuelScored(0);
          setTeleopFuelScored(0);
          setFieldRoute(null);
          setPlayedDefense(null);
          setDefenseEffectiveness(null);
          setRobotIssues(null);
          setWhatHappenedNote('');
          setQuickNote('');
        }
      });
    }
  }, [teamNumber, matchNumber]);

  // Quick increment/decrement helper ensuring values never go below 0
  const adjustValue = (current: number, delta: number) => {
    return Math.max(0, current + delta);
  };

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const teamNum = parseInt(teamNumber, 10);
    if (isNaN(teamNum) || teamNum <= 0) {
      setToastMessage('Please enter a valid Team Number');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    const record: MatchScoutingRecord = {
      id: `match-m${matchNumber}-t${teamNum}-${Date.now()}`,
      teamNumber: teamNum,
      matchNumber,
      timestamp: Date.now(),

      // 1. AUTONOMOUS
      autoWorked: autoWorked !== null ? autoWorked : false,
      autoFuelScored,

      // 2. SCORING
      teleopFuelScored,

      // 3. FIELD ROUTE
      fieldRoute: fieldRoute || 'NEITHER',

      // 4. DEFENSE
      playedDefense: playedDefense === true,
      defenseEffectiveness: playedDefense === true ? (defenseEffectiveness || 'MEDIUM') : undefined,

      // 5. ROBOT RELIABILITY
      robotIssues: robotIssues || 'NONE',
      whatHappenedNote: (robotIssues && robotIssues !== 'NONE') ? whatHappenedNote : undefined,

      // 6. QUICK OBSERVATION
      quickNote: quickNote.trim() || undefined,

      // Legacy field aliases for backward compatibility with existing profile aggregations
      autoHighScored: autoFuelScored,
      teleopHighScored: teleopFuelScored,
      notes: quickNote,
    };

    // Save match observation
    await scoutingDB.saveMatch(record);

    // Auto-associate observation with the selected team's existing profile or create new team profile
    const existingTeam = await scoutingDB.getTeam(teamNum);
    if (!existingTeam) {
      await scoutingDB.saveTeam({
        teamNumber: teamNum,
        teamName: `Team ${teamNum}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      await scoutingDB.saveTeam({
        ...existingTeam,
        updatedAt: Date.now(),
      });
    }

    setToastMessage(`Match ${matchNumber} saved for Team ${teamNum}`);

    // Reset form for next fresh match (nothing pre-selected)
    setTimeout(() => {
      setToastMessage(null);
      setMatchNumber((prev) => prev + 1);
      setTeamNumber('');
      setAutoWorked(null);
      setAutoFuelScored(0);
      setTeleopFuelScored(0);
      setFieldRoute(null);
      setPlayedDefense(null);
      setDefenseEffectiveness(null);
      setRobotIssues(null);
      setWhatHappenedNote('');
      setQuickNote('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onNavigate('home');
    }, 1200);
  };

  const handleGenerateSingleMatchQr = async () => {
    const teamNum = parseInt(teamNumber, 10);
    if (isNaN(teamNum) || teamNum <= 0) {
      setToastMessage('Please enter a valid Team Number first');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    const scoutProfile = scoutingAssignments.getProfile();
    const scoutName = scoutProfile.name || 'Scout';

    const record: MatchScoutingRecord = {
      id: `match-m${matchNumber}-t${teamNum}-${Date.now()}`,
      teamNumber: teamNum,
      matchNumber,
      timestamp: Date.now(),

      // 1. AUTONOMOUS
      autoWorked: autoWorked !== null ? autoWorked : false,
      autoFuelScored,

      // 2. SCORING
      teleopFuelScored,

      // 3. FIELD ROUTE
      fieldRoute: fieldRoute || 'NEITHER',

      // 4. DEFENSE
      playedDefense: playedDefense === true,
      defenseEffectiveness: playedDefense === true ? (defenseEffectiveness || 'MEDIUM') : undefined,

      // 5. ROBOT RELIABILITY
      robotIssues: robotIssues || 'NONE',
      whatHappenedNote: (robotIssues && robotIssues !== 'NONE') ? whatHappenedNote : undefined,

      // 6. QUICK OBSERVATION
      quickNote: quickNote.trim() || undefined,
      impression: (impression as 1 | 2 | 3 | 4 | 5) || undefined,

      // Legacy field aliases
    };

    const payloadStr = qrTransferEngine.generateSingleMatchQr(scoutName, record);

    try {
      const url = await QRCode.toDataURL(payloadStr, { errorCorrectionLevel: 'L', margin: 1, width: 280 });
      setSingleQrUrl(url);
      setIsSingleQrOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <form onSubmit={handleSaveMatch} className="max-w-xl mx-auto px-3.5 sm:px-5 py-5 pb-32 flex flex-col gap-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-mono font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar Header */}
      <div className="sticky top-13 z-30 bg-slate-950/95 backdrop-blur-md -mx-3.5 px-3.5 py-3 border-b border-slate-800 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black font-mono text-slate-100 tracking-tight uppercase">
              MATCH SCOUT
            </h1>
          </div>
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black font-mono text-xs sm:text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>SAVE MATCH</span>
        </button>
      </div>

      {/* MATCH IDENTIFICATION */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
          <span>MATCH IDENTIFICATION</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Match Number Counter */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase text-slate-400">
              Match #
            </span>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMatchNumber((prev) => Math.max(1, prev - 1))}
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-lg active:scale-90 cursor-pointer border border-slate-700"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                required
                value={matchNumber}
                onChange={(e) => setMatchNumber(parseInt(e.target.value, 10) || 1)}
                className="w-16 text-center text-xl font-mono font-black bg-transparent text-amber-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setMatchNumber((prev) => prev + 1)}
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-lg active:scale-90 cursor-pointer border border-slate-700"
              >
                +
              </button>
            </div>
          </div>

          {/* Team Number Input */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase text-slate-400">
              Team Number
            </span>
            <input
              type="number"
              required
              placeholder="Team #"
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-750 rounded-lg py-2 px-3 text-lg font-mono font-black text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/80"
            />
          </div>
        </div>
      </div>

      {/* 1. AUTONOMOUS */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
          <Zap className="w-4 h-4" />
          <span>1. AUTONOMOUS</span>
        </div>

        {/* Auto Worked? YES / NO */}
        <div>
          <span className="block text-xs font-mono font-semibold uppercase text-slate-300 mb-2">
            Auto Worked?
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setAutoWorked(true)}
              className={`py-3 rounded-xl font-mono font-bold text-sm uppercase transition-all cursor-pointer flex items-center justify-center gap-2 ${
                autoWorked === true
                  ? 'bg-blue-600 text-white shadow-md border border-blue-400'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-850'
              }`}
            >
              {autoWorked === true && <Check className="w-4 h-4" />}
              <span>YES</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoWorked(false)}
              className={`py-3 rounded-xl font-mono font-bold text-sm uppercase transition-all cursor-pointer flex items-center justify-center gap-2 ${
                autoWorked === false
                  ? 'bg-rose-600 text-white shadow-md border border-rose-400'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-850'
              }`}
            >
              {autoWorked === false && <Check className="w-4 h-4" />}
              <span>NO</span>
            </button>
          </div>
        </div>

        {/* Auto Fuel Scored Counter */}
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase text-slate-300">
              Auto Fuel Scored
            </span>
            <span className="text-xl font-mono font-black text-blue-400 px-3 py-0.5 rounded-lg bg-slate-950 border border-slate-800">
              {autoFuelScored}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, -20))}
              className="py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-rose-400 font-mono font-bold text-xs border border-slate-800 active:scale-95 cursor-pointer"
            >
              −20
            </button>
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, -5))}
              className="py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-rose-400 font-mono font-bold text-xs border border-slate-800 active:scale-95 cursor-pointer"
            >
              −5
            </button>
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, -1))}
              className="py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-rose-400 font-mono font-bold text-xs border border-slate-800 active:scale-95 cursor-pointer"
            >
              −1
            </button>

            <div className="py-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono font-black text-sm border border-slate-750 flex items-center justify-center">
              {autoFuelScored}
            </div>

            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, 1))}
              className="py-2.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 font-mono font-bold text-xs border border-blue-800 active:scale-95 cursor-pointer"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, 5))}
              className="py-2.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 font-mono font-bold text-xs border border-blue-800 active:scale-95 cursor-pointer"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, 20))}
              className="py-2.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 font-mono font-bold text-xs border border-blue-800 active:scale-95 cursor-pointer"
            >
              +20
            </button>
          </div>
        </div>
      </div>

      {/* 2. SCORING */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
          <Target className="w-4 h-4" />
          <span>2. SCORING</span>
        </div>

        {/* Teleop Fuel Scored Counter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase text-slate-300">
              Teleop Fuel Scored
            </span>
            <span className="text-xl font-mono font-black text-emerald-400 px-3 py-0.5 rounded-lg bg-slate-950 border border-slate-800">
              {teleopFuelScored}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, -20))}
              className="py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-rose-400 font-mono font-bold text-xs border border-slate-800 active:scale-95 cursor-pointer"
            >
              −20
            </button>
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, -5))}
              className="py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-rose-400 font-mono font-bold text-xs border border-slate-800 active:scale-95 cursor-pointer"
            >
              −5
            </button>
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, -1))}
              className="py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-rose-400 font-mono font-bold text-xs border border-slate-800 active:scale-95 cursor-pointer"
            >
              −1
            </button>

            <div className="py-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono font-black text-sm border border-slate-750 flex items-center justify-center">
              {teleopFuelScored}
            </div>

            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, 1))}
              className="py-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-mono font-bold text-xs border border-emerald-800 active:scale-95 cursor-pointer"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, 5))}
              className="py-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-mono font-bold text-xs border border-emerald-800 active:scale-95 cursor-pointer"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, 20))}
              className="py-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-mono font-bold text-xs border border-emerald-800 active:scale-95 cursor-pointer"
            >
              +20
            </button>
          </div>
        </div>
      </div>

      {/* 3. FIELD ROUTE */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-purple-400">
          <Route className="w-4 h-4" />
          <span>3. FIELD ROUTE</span>
        </div>

        <span className="block text-xs font-mono font-semibold uppercase text-slate-300">
          Field Route Used
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(['BUMP', 'TRENCH', 'BOTH', 'NEITHER'] as FieldRouteType[]).map((route) => (
            <button
              key={route}
              type="button"
              onClick={() => setFieldRoute(route)}
              className={`py-3 rounded-xl font-mono font-bold text-xs sm:text-sm uppercase transition-all cursor-pointer ${
                fieldRoute === route
                  ? 'bg-purple-600 text-white shadow-md border border-purple-400'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-850'
              }`}
            >
              {route}
            </button>
          ))}
        </div>
      </div>

      {/* 4. DEFENSE */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
          <Shield className="w-4 h-4" />
          <span>4. DEFENSE</span>
        </div>

        {/* Played Defense? YES / NO */}
        <div>
          <span className="block text-xs font-mono font-semibold uppercase text-slate-300 mb-2">
            Played Defense?
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setPlayedDefense(true)}
              className={`py-3 rounded-xl font-mono font-bold text-sm uppercase transition-all cursor-pointer flex items-center justify-center gap-2 ${
                playedDefense === true
                  ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-300'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-850'
              }`}
            >
              {playedDefense === true && <Check className="w-4 h-4" />}
              <span>YES</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlayedDefense(false);
                setDefenseEffectiveness(null);
              }}
              className={`py-3 rounded-xl font-mono font-bold text-sm uppercase transition-all cursor-pointer flex items-center justify-center gap-2 ${
                playedDefense === false
                  ? 'bg-slate-800 text-slate-200 shadow-md border border-slate-700'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-850'
              }`}
            >
              {playedDefense === false && <Check className="w-4 h-4" />}
              <span>NO</span>
            </button>
          </div>
        </div>

        {/* Reveal Defense Effectiveness only if YES */}
        {playedDefense === true && (
          <div className="pt-2 border-t border-slate-800/80 animate-fadeIn space-y-2">
            <span className="block text-xs font-mono font-semibold uppercase text-amber-300">
              Defense Effectiveness
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {(['LOW', 'MEDIUM', 'HIGH'] as DefenseEffectivenessType[]).map((eff) => (
                <button
                  key={eff}
                  type="button"
                  onClick={() => setDefenseEffectiveness(eff)}
                  className={`py-2.5 rounded-xl font-mono font-bold text-xs uppercase transition-all cursor-pointer ${
                    defenseEffectiveness === eff
                      ? 'bg-slate-800 text-slate-100 shadow border border-slate-600'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  {eff}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. ROBOT RELIABILITY */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-rose-400">
          <AlertTriangle className="w-4 h-4" />
          <span>5. ROBOT RELIABILITY</span>
        </div>

        <span className="block text-xs font-mono font-semibold uppercase text-slate-300">
          Robot Issues
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(['NONE', 'MINOR', 'MAJOR', 'DISABLED'] as RobotIssuesType[]).map((issue) => (
            <button
              key={issue}
              type="button"
              onClick={() => setRobotIssues(issue)}
              className={`py-3 rounded-xl font-mono font-bold text-xs sm:text-sm uppercase transition-all cursor-pointer ${
                robotIssues === issue
                  ? issue === 'NONE'
                    ? 'bg-emerald-600 text-white shadow-md border border-emerald-400'
                    : 'bg-rose-600 text-white shadow-md border border-rose-400'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-850'
              }`}
            >
              {issue}
            </button>
          ))}
        </div>

        {/* Reveal note if anything other than NONE */}
        {robotIssues && robotIssues !== 'NONE' && (
          <div className="pt-2 border-t border-slate-800/80 animate-fadeIn space-y-2">
            <span className="block text-xs font-mono font-semibold uppercase text-rose-300">
              What happened?
            </span>
            <input
              type="text"
              placeholder="Short note regarding the issue..."
              value={whatHappenedNote}
              onChange={(e) => setWhatHappenedNote(e.target.value)}
              className="w-full bg-slate-950 border border-rose-900/60 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        )}
      </div>

      {/* 6. QUICK OBSERVATION */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
          <MessageSquare className="w-4 h-4" />
          <span>6. QUICK OBSERVATION</span>
        </div>

        <span className="block text-xs font-mono font-semibold uppercase text-slate-300">
          Quick Note (Optional)
        </span>

        <textarea
          rows={3}
          placeholder="Important observations about this robot..."
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-700 resize-none"
        />

        {/* Impression */}
        <div className="space-y-2">
          <span className="block text-xs font-mono font-semibold uppercase text-slate-300">
            Impression (1-5)
          </span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setImpression(star)}
                className={`p-3 rounded-xl transition-all ${
                  impression && impression >= star
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-950 text-slate-600'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM SAVE & QR BUTTONS */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          type="submit"
          className="py-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 font-bold font-mono text-xs sm:text-sm uppercase tracking-wider shadow-xl transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4 text-slate-300" />
          <span>SAVE MATCH</span>
        </button>

        <button
          type="button"
          onClick={handleGenerateSingleMatchQr}
          className="py-4 rounded-2xl bg-[#141a23]/85 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold font-mono text-xs sm:text-sm uppercase tracking-wider shadow-xl transition-all cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <QrCode className="w-4 h-4 text-slate-300" />
          <span>Show QR Code</span>
        </button>
      </div>

      {/* SINGLE QR DISPLAY MODAL */}
      {isSingleQrOpen && singleQrUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#141a23] border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-slate-200 uppercase tracking-wider">
                Match QR: Team #{teamNumber}
              </span>
              <button
                type="button"
                onClick={() => setIsSingleQrOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-mono">
              Have <strong>Captain</strong> scan this QR code with "Scan Scout Data QR" to import:
            </p>

            <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-lg">
              <img src={singleQrUrl} alt="Single Match Data QR" className="w-52 h-52 mx-auto" />
            </div>

            <button
              type="button"
              onClick={() => setIsSingleQrOpen(false)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </form>
  );
};
