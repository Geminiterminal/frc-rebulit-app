import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  MatchScoutingRecord, 
  FieldRouteType, 
  DefenseEffectivenessType, 
  RobotIssuesType,
  EventScheduleMatch 
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
  X,
  Calendar
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
  const [teamSchedule, setTeamSchedule] = useState<EventScheduleMatch[]>([]);

  // 1. AUTONOMOUS
  const [autoWorked, setAutoWorked] = useState<boolean | null>(null);
  const [autoFuelScored, setAutoFuelScored] = useState<number>(0);

  // 2. SCORING
  const [teleopFuelScored, setTeleopFuelScored] = useState<number>(0);

  // 3. FIELD ROUTE
  const [fieldRoute, setFieldRoute] = useState<FieldRouteType | null>(null);

  // 4. DEFENSE
  const [playedDefense, setPlayedDefense] = useState<boolean | null>(null);
  const [defenseEffectiveness, setDefenseEffectiveness] = useState<DefenseEffectivenessType | null>(null);

  // 5. ROBOT RELIABILITY
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

  useEffect(() => {
    const teamNum = parseInt(teamNumber, 10);
    if (!isNaN(teamNum) && teamNum > 0) {
      scoutingDB.getScheduleForTeam(teamNum).then((sched) => {
        setTeamSchedule(sched);
      });
    } else {
      setTeamSchedule([]);
    }
  }, [teamNumber]);

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

  const adjustValue = (current: number, delta: number) => {
    return Math.max(0, current + delta);
  };

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const teamNum = parseInt(teamNumber, 10);
    if (isNaN(teamNum) || teamNum <= 0) {
      setToastMessage('Enter valid Team Number');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    const record: MatchScoutingRecord = {
      id: `match-m${matchNumber}-t${teamNum}-${Date.now()}`,
      teamNumber: teamNum,
      matchNumber,
      timestamp: Date.now(),
      autoWorked: autoWorked !== null ? autoWorked : false,
      autoFuelScored,
      teleopFuelScored,
      fieldRoute: fieldRoute || 'NEITHER',
      playedDefense: playedDefense === true,
      defenseEffectiveness: playedDefense === true ? (defenseEffectiveness || 'MEDIUM') : undefined,
      robotIssues: robotIssues || 'NONE',
      whatHappenedNote: (robotIssues && robotIssues !== 'NONE') ? whatHappenedNote : undefined,
      quickNote: quickNote.trim() || undefined,
      autoHighScored: autoFuelScored,
      teleopHighScored: teleopFuelScored,
      notes: quickNote,
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
    } else {
      await scoutingDB.saveTeam({
        ...existingTeam,
        updatedAt: Date.now(),
      });
    }

    setToastMessage(`Match ${matchNumber} saved for Team ${teamNum}`);

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
    }, 1000);
  };

  const handleGenerateSingleMatchQr = async () => {
    const teamNum = parseInt(teamNumber, 10);
    if (isNaN(teamNum) || teamNum <= 0) {
      setToastMessage('Enter valid Team Number first');
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
      autoWorked: autoWorked !== null ? autoWorked : false,
      autoFuelScored,
      teleopFuelScored,
      fieldRoute: fieldRoute || 'NEITHER',
      playedDefense: playedDefense === true,
      defenseEffectiveness: playedDefense === true ? (defenseEffectiveness || 'MEDIUM') : undefined,
      robotIssues: robotIssues || 'NONE',
      whatHappenedNote: (robotIssues && robotIssues !== 'NONE') ? whatHappenedNote : undefined,
      quickNote: quickNote.trim() || undefined,
      impression: (impression as 1 | 2 | 3 | 4 | 5) || undefined,
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
    <form onSubmit={handleSaveMatch} className="max-w-xl mx-auto px-3.5 sm:px-5 py-4 pb-32 flex flex-col gap-4">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-slate-100 font-mono font-bold text-xs px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar Header */}
      <div className="sticky top-13 z-30 bg-slate-950/95 backdrop-blur-md -mx-3.5 px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm sm:text-base font-bold font-mono text-slate-100 tracking-tight uppercase">
            MATCH SCOUT
          </h1>
        </div>

        <button
          type="submit"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 font-bold font-mono text-xs uppercase shadow transition-all cursor-pointer border border-slate-700"
        >
          <Save className="w-4 h-4" />
          <span>SAVE</span>
        </button>
      </div>

      {/* MATCH IDENTIFICATION */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
          Match Setup
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Match Counter */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
            <span className="text-[11px] font-mono font-bold uppercase text-slate-400">
              Match #
            </span>
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setMatchNumber((prev) => Math.max(1, prev - 1))}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer border border-slate-700"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                required
                value={matchNumber}
                onChange={(e) => setMatchNumber(parseInt(e.target.value, 10) || 1)}
                className="w-12 text-center text-lg font-mono font-bold bg-transparent text-slate-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setMatchNumber((prev) => prev + 1)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer border border-slate-700"
              >
                +
              </button>
            </div>
          </div>

          {/* Team Number */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
            <span className="text-[11px] font-mono font-bold uppercase text-slate-400">
              Team Number
            </span>
            <input
              type="number"
              required
              placeholder="Team #"
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2.5 text-base font-mono font-bold text-white placeholder-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>

        {/* Scheduled Matches Quick Selector */}
        {teamSchedule.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Scheduled Matches for Team {teamNumber}</span>
              </span>
              <span className="text-[10px] text-slate-500">{teamSchedule.length} found</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {teamSchedule.map((m) => {
                const isSelected = matchNumber === m.matchNumber;
                const isRed = m.redTeams.includes(parseInt(teamNumber, 10));
                const allianceBadge = isRed ? 'border-rose-900/80 text-rose-300' : 'border-sky-900/80 text-sky-300';
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMatchNumber(m.matchNumber)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : `bg-slate-950 hover:bg-slate-850 text-slate-300 ${allianceBadge}`
                    }`}
                  >
                    <span>Qual {m.matchNumber}</span>
                    <span className={`w-2 h-2 rounded-full ${isRed ? 'bg-rose-500' : 'bg-sky-500'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 1. AUTONOMOUS */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
          <Zap className="w-3.5 h-3.5 text-slate-400" />
          <span>1. Autonomous</span>
        </div>

        {/* Auto Worked */}
        <div>
          <span className="block text-[11px] font-mono font-semibold uppercase text-slate-400 mb-1.5">
            Auto Worked?
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAutoWorked(true)}
              className={`py-2 rounded-xl font-mono font-bold text-xs uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                autoWorked === true
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
              }`}
            >
              {autoWorked === true && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              <span>YES</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoWorked(false)}
              className={`py-2 rounded-xl font-mono font-bold text-xs uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                autoWorked === false
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
              }`}
            >
              {autoWorked === false && <Check className="w-3.5 h-3.5 text-rose-400" />}
              <span>NO</span>
            </button>
          </div>
        </div>

        {/* Auto Fuel Counter */}
        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-slate-300">
            <span>Auto Fuel Scored</span>
            <span className="text-base font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-100">
              {autoFuelScored}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, -20))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 font-mono font-bold text-xs border border-slate-850"
            >
              −20
            </button>
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, -5))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 font-mono font-bold text-xs border border-slate-850"
            >
              −5
            </button>
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, -1))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 font-mono font-bold text-xs border border-slate-850"
            >
              −1
            </button>

            <div className="py-2 rounded-lg bg-slate-900 text-slate-100 font-mono font-bold text-xs border border-slate-800 flex items-center justify-center">
              {autoFuelScored}
            </div>

            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, 1))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 font-mono font-bold text-xs border border-slate-850"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, 5))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 font-mono font-bold text-xs border border-slate-850"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => setAutoFuelScored((val) => adjustValue(val, 20))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 font-mono font-bold text-xs border border-slate-850"
            >
              +20
            </button>
          </div>
        </div>
      </div>

      {/* 2. SCORING */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
          <Target className="w-3.5 h-3.5 text-slate-400" />
          <span>2. Teleop Scoring</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-300">
            <span>Teleop Fuel Scored</span>
            <span className="text-base font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-100">
              {teleopFuelScored}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, -20))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 font-mono font-bold text-xs border border-slate-850"
            >
              −20
            </button>
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, -5))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 font-mono font-bold text-xs border border-slate-850"
            >
              −5
            </button>
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, -1))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 font-mono font-bold text-xs border border-slate-850"
            >
              −1
            </button>

            <div className="py-2 rounded-lg bg-slate-900 text-slate-100 font-mono font-bold text-xs border border-slate-800 flex items-center justify-center">
              {teleopFuelScored}
            </div>

            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, 1))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 font-mono font-bold text-xs border border-slate-850"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, 5))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 font-mono font-bold text-xs border border-slate-850"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => setTeleopFuelScored((val) => adjustValue(val, 20))}
              className="py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 font-mono font-bold text-xs border border-slate-850"
            >
              +20
            </button>
          </div>
        </div>
      </div>

      {/* 3. FIELD ROUTE */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
          <Route className="w-3.5 h-3.5 text-slate-400" />
          <span>3. Field Route</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['BUMP', 'TRENCH', 'BOTH', 'NEITHER'] as FieldRouteType[]).map((route) => (
            <button
              key={route}
              type="button"
              onClick={() => setFieldRoute(route)}
              className={`py-2.5 rounded-xl font-mono font-bold text-xs uppercase transition-all cursor-pointer ${
                fieldRoute === route
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
              }`}
            >
              {route}
            </button>
          ))}
        </div>
      </div>

      {/* 4. DEFENSE */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>4. Defense</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPlayedDefense(true)}
            className={`py-2 rounded-xl font-mono font-bold text-xs uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              playedDefense === true
                ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
            }`}
          >
            {playedDefense === true && <Check className="w-3.5 h-3.5 text-amber-400" />}
            <span>YES</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPlayedDefense(false);
              setDefenseEffectiveness(null);
            }}
            className={`py-2 rounded-xl font-mono font-bold text-xs uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              playedDefense === false
                ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
            }`}
          >
            {playedDefense === false && <Check className="w-3.5 h-3.5 text-slate-400" />}
            <span>NO</span>
          </button>
        </div>

        {playedDefense === true && (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <span className="block text-[11px] font-mono font-semibold uppercase text-slate-400">
              Defense Effectiveness
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH'] as DefenseEffectivenessType[]).map((eff) => (
                <button
                  key={eff}
                  type="button"
                  onClick={() => setDefenseEffectiveness(eff)}
                  className={`py-2 rounded-xl font-mono font-bold text-xs uppercase transition-all cursor-pointer ${
                    defenseEffectiveness === eff
                      ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
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
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
          <span>5. Issues</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['NONE', 'MINOR', 'MAJOR', 'DISABLED'] as RobotIssuesType[]).map((issue) => (
            <button
              key={issue}
              type="button"
              onClick={() => setRobotIssues(issue)}
              className={`py-2.5 rounded-xl font-mono font-bold text-xs uppercase transition-all cursor-pointer ${
                robotIssues === issue
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
              }`}
            >
              {issue}
            </button>
          ))}
        </div>

        {robotIssues && robotIssues !== 'NONE' && (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <input
              type="text"
              placeholder="Issue details..."
              value={whatHappenedNote}
              onChange={(e) => setWhatHappenedNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </div>
        )}
      </div>

      {/* 6. QUICK OBSERVATION */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
          <span>6. Notes</span>
        </div>

        <textarea
          rows={2}
          placeholder="Observations..."
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 resize-none"
        />
      </div>

      {/* BOTTOM ACTIONS */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="submit"
          className="py-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 font-bold font-mono text-xs uppercase tracking-wider shadow transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Save className="w-4 h-4 text-slate-300" />
          <span>SAVE MATCH</span>
        </button>

        <button
          type="button"
          onClick={handleGenerateSingleMatchQr}
          className="py-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-bold font-mono text-xs uppercase tracking-wider shadow transition-all cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5"
        >
          <QrCode className="w-4 h-4 text-slate-300" />
          <span>Show QR</span>
        </button>
      </div>

      {/* SINGLE QR DISPLAY MODAL */}
      {isSingleQrOpen && singleQrUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
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
