import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  TeamProfile, 
  PitData, 
  DrivetrainType, 
  ShooterType, 
  ShootingAccuracy, 
  BumpTrenchCapability, 
  AutoConsistency, 
  BiggestIssue, 
  ReliabilityRating
} from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { scoutingAssignments } from '../../db/scoutingAssignments';
import { qrTransferEngine } from '../../utils/qrTransferEngine';
import { ScoutingAssignmentsCard } from '../scouting/ScoutingAssignmentsCard';
import { 
  Check, 
  Save, 
  ArrowLeft, 
  Plus, 
  Minus, 
  X,
  QrCode
} from 'lucide-react';

interface PitScoutFormProps {
  initialTeamNumber?: number;
  onNavigate: (view: string, teamNumber?: number) => void;
  onBack: () => void;
}

const DRIVETRAIN_OPTIONS: DrivetrainType[] = [
  'SWERVE',
  'TANK / WEST COAST',
  'MECANUM',
  'OTHER',
];

const SHOOTER_OPTIONS: ShooterType[] = [
  'FIXED',
  'TURRET',
  'PIVOTING',
  'DUMPER',
  'OTHER',
];

const ACCURACY_OPTIONS: ShootingAccuracy[] = [
  '<50%',
  '50–69%',
  '70–84%',
  '85–94%',
  '95%+',
];

const SHOOT_FROM_OPTIONS = [
  'ANYWHERE',
  'MOST OF FIELD',
  'LIMITED AREA',
  'FIXED SPOT',
];

const BUMP_TRENCH_OPTIONS: BumpTrenchCapability[] = [
  'BUMP AND TRENCH',
  'BUMP ONLY',
  'TRENCH ONLY',
];

const AUTO_CONSISTENCY_OPTIONS: AutoConsistency[] = [
  'VERY CONSISTENT',
  'MOSTLY CONSISTENT',
  'SOMETIMES',
  'RARELY',
  'STILL TUNING',
];

const BIGGEST_ISSUES_OPTIONS: BiggestIssue[] = [
  'MECHANICAL',
  'ELECTRICAL',
  'SOFTWARE',
  'SHOOTING',
  'INTAKE',
  'DRIVETRAIN',
  'AUTONOMOUS',
  'ENDGAME',
  'NONE',
  'OTHER',
];

const RELIABILITY_OPTIONS: ReliabilityRating[] = [
  'VERY RELIABLE',
  'MOSTLY RELIABLE',
  'SOMEWHAT RELIABLE',
  'UNRELIABLE',
];

export const PitScoutForm: React.FC<PitScoutFormProps> = ({
  initialTeamNumber,
  onNavigate,
}) => {
  const [teamNumberInput, setTeamNumberInput] = useState<string>(
    initialTeamNumber ? initialTeamNumber.toString() : ''
  );
  const [teamConfirmed, setTeamConfirmed] = useState<boolean>(!!initialTeamNumber);
  const [teamExistsMessage, setTeamExistsMessage] = useState<string | null>(null);

  const [teamName, setTeamName] = useState<string>('');
  const [drivetrain, setDrivetrain] = useState<DrivetrainType | null>(null);
  const [drivetrainOther, setDrivetrainOther] = useState<string>('');

  const [shooter, setShooter] = useState<ShooterType[]>([]);
  const [shooterOther, setShooterOther] = useState<string>('');

  const [hopperCapacity, setHopperCapacity] = useState<number | ''>('');
  const [shootingAccuracy, setShootingAccuracy] = useState<ShootingAccuracy | null>(null);
  const [canShootAnywhere, setCanShootAnywhere] = useState<string>('');

  const [bumpTrench, setBumpTrench] = useState<BumpTrenchCapability | null>(null);

  const [hasAutonomous, setHasAutonomous] = useState<'YES' | 'NO' | 'STILL DEVELOPING' | null>(null);
  const [autoRoutinesCount, setAutoRoutinesCount] = useState<'1' | '2' | '3' | '4+' | null>(null);

  const [autoConsistency, setAutoConsistency] = useState<AutoConsistency | null>(null);

  const [biggestIssues, setBiggestIssues] = useState<BiggestIssue[]>([]);
  const [biggestIssueOther, setBiggestIssueOther] = useState<string>('');

  const [reliability, setReliability] = useState<ReliabilityRating | null>(null);
  const [notes, setNotes] = useState<string>('');

  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isSingleQrOpen, setIsSingleQrOpen] = useState<boolean>(false);
  const [singleQrUrl, setSingleQrUrl] = useState<string | null>(null);

  const resetToBlankState = () => {
    setTeamName('');
    setDrivetrain(null);
    setDrivetrainOther('');
    setShooter([]);
    setShooterOther('');
    setHopperCapacity('');
    setShootingAccuracy(null);
    setCanShootAnywhere('');
    setBumpTrench(null);
    setHasAutonomous(null);
    setAutoRoutinesCount(null);
    setAutoConsistency(null);
    setBiggestIssues([]);
    setBiggestIssueOther('');
    setReliability(null);
    setNotes('');
  };

  useEffect(() => {
    const num = parseInt(teamNumberInput, 10);
    if (!isNaN(num) && num > 0) {
      scoutingDB.getTeam(num).then((existing) => {
        if (existing) {
          setTeamExistsMessage(`Team ${num} (${existing.teamName || 'Existing Profile'})`);
          if (teamConfirmed) {
            loadExistingTeam(existing);
          }
        } else {
          setTeamExistsMessage(null);
          if (teamConfirmed) {
            resetToBlankState();
          }
        }
      });
    } else {
      setTeamExistsMessage(null);
      if (teamConfirmed) {
        resetToBlankState();
      }
    }
  }, [teamNumberInput, teamConfirmed]);

  const loadExistingTeam = (t: TeamProfile) => {
    setTeamName(t.teamName || '');
    if (t.pit) {
      setDrivetrain(t.pit.drivetrain || null);
      setDrivetrainOther(t.pit.drivetrainOther || '');
      setShooter(t.pit.shooter || []);
      setShooterOther(t.pit.shooterOther || '');
      setHopperCapacity(t.pit.hopperCapacity !== undefined ? t.pit.hopperCapacity : '');
      setShootingAccuracy(t.pit.shootingAccuracy || null);
      setCanShootAnywhere(t.pit.canShootAnywhere || '');
      setBumpTrench(t.pit.bumpTrench || null);
      setHasAutonomous(t.pit.hasAutonomous || null);
      setAutoRoutinesCount(t.pit.autoRoutinesCount || null);
      setAutoConsistency(t.pit.autoConsistency || null);
      setBiggestIssues(t.pit.biggestIssues || []);
      setBiggestIssueOther(t.pit.biggestIssueOther || '');
      setReliability(t.pit.reliability || null);
      setNotes(t.pit.notes || '');
    } else {
      resetToBlankState();
      setTeamName(t.teamName || '');
    }
  };

  const handleStartQuestionnaire = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(teamNumberInput.trim(), 10);
    if (isNaN(num) || num <= 0) return;
    setTeamConfirmed(true);
  };

  const toggleMultiSelect = <T extends string>(list: T[], item: T, setList: (vals: T[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const toggleIssue = (issue: BiggestIssue) => {
    if (issue === 'NONE') {
      setBiggestIssues(biggestIssues.includes('NONE') ? [] : ['NONE']);
      return;
    }
    const filtered = biggestIssues.filter((i) => i !== 'NONE');
    if (filtered.includes(issue)) {
      setBiggestIssues(filtered.filter((i) => i !== issue));
    } else {
      setBiggestIssues([...filtered, issue]);
    }
  };

  const handleSaveTeam = async () => {
    const num = parseInt(teamNumberInput, 10);
    if (isNaN(num) || num <= 0) return;

    const pitData: PitData = {
      drivetrain: drivetrain || undefined,
      drivetrainOther: drivetrain === 'OTHER' ? drivetrainOther : undefined,
      shooter: shooter.length > 0 ? shooter : undefined,
      shooterOther: shooter.includes('OTHER') ? shooterOther : undefined,
      hopperCapacity: typeof hopperCapacity === 'number' ? hopperCapacity : undefined,
      shootingAccuracy: shootingAccuracy || undefined,
      canShootAnywhere: canShootAnywhere || undefined,
      bumpTrench: bumpTrench || undefined,
      hasAutonomous: hasAutonomous || undefined,
      autoRoutinesCount: hasAutonomous === 'YES' ? (autoRoutinesCount || undefined) : undefined,
      autoConsistency: autoConsistency || undefined,
      biggestIssues: biggestIssues.length > 0 ? biggestIssues : undefined,
      biggestIssueOther: biggestIssues.includes('OTHER') ? biggestIssueOther : undefined,
      reliability: reliability || undefined,
      notes,
      lastUpdated: Date.now(),
    };

    const existing = await scoutingDB.getTeam(num);
    const profile: TeamProfile = {
      teamNumber: num,
      teamName: teamName || existing?.teamName || `Team ${num}`,
      pit: pitData,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await scoutingDB.saveTeam(profile);
    setSaveToast(`Team ${num} saved.`);

    setTimeout(() => {
      setSaveToast(null);
      onNavigate('home');
    }, 1000);
  };

  const handleGenerateSinglePitQr = async () => {
    const num = parseInt(teamNumberInput, 10);
    if (isNaN(num) || num <= 0) return;

    const scoutProfile = scoutingAssignments.getProfile();
    const scoutName = scoutProfile.name || 'Scout';

    const pitData: PitData = {
      drivetrain: drivetrain || undefined,
      drivetrainOther: drivetrain === 'OTHER' ? drivetrainOther : undefined,
      shooter: shooter.length > 0 ? shooter : undefined,
      shooterOther: shooter.includes('OTHER') ? shooterOther : undefined,
      hopperCapacity: typeof hopperCapacity === 'number' ? hopperCapacity : undefined,
      shootingAccuracy: shootingAccuracy || undefined,
      canShootAnywhere: canShootAnywhere || undefined,
      bumpTrench: bumpTrench || undefined,
      hasAutonomous: hasAutonomous || undefined,
      autoRoutinesCount: hasAutonomous === 'YES' ? (autoRoutinesCount || undefined) : undefined,
      autoConsistency: autoConsistency || undefined,
      biggestIssues: biggestIssues.length > 0 ? biggestIssues : undefined,
      biggestIssueOther: biggestIssues.includes('OTHER') ? biggestIssueOther : undefined,
      reliability: reliability || undefined,
      notes,
      lastUpdated: Date.now(),
    };

    const payloadStr = qrTransferEngine.generateSinglePitQr(scoutName, num, pitData);

    try {
      const url = await QRCode.toDataURL(payloadStr, { errorCorrectionLevel: 'L', margin: 1, width: 280 });
      setSingleQrUrl(url);
      setIsSingleQrOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const [rosterTeams, setRosterTeams] = useState<TeamProfile[]>([]);

  useEffect(() => {
    scoutingDB.getAllTeams().then((all) => {
      setRosterTeams(all.sort((a, b) => a.teamNumber - b.teamNumber));
    });
  }, []);

  if (!teamConfirmed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        <ScoutingAssignmentsCard
          onSelectTeam={(num) => {
            setTeamNumberInput(String(num));
            setTeamConfirmed(true);
          }}
          onNavigate={onNavigate}
        />

        {rosterTeams.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <label className="text-xs font-mono font-bold uppercase text-slate-300 block">
              Event Roster ({rosterTeams.length} Teams)
            </label>
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setTeamNumberInput(val);
                  setTeamConfirmed(true);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-slate-600 cursor-pointer"
            >
              <option value="">-- Choose Team to Pit Scout --</option>
              {rosterTeams.map((t) => (
                <option key={t.teamNumber} value={t.teamNumber}>
                  #{t.teamNumber} - {t.teamName} {t.officialRank ? `(Rank ${t.officialRank})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <form onSubmit={handleStartQuestionnaire} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 text-center">
          <div className="text-xs font-mono font-semibold uppercase text-slate-400 tracking-wider">
            Team Number
          </div>
          <input
            type="number"
            placeholder="Team #"
            value={teamNumberInput}
            onChange={(e) => setTeamNumberInput(e.target.value)}
            className="w-full text-center text-3xl font-mono font-bold tracking-wider bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-600"
          />

          {teamExistsMessage && (
            <div className="text-xs text-slate-300 font-mono">
              {teamExistsMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={!teamNumberInput.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition-colors shadow active:scale-95 cursor-pointer disabled:opacity-40"
          >
            Start Pit Scouting
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-3.5 sm:px-5 py-4 pb-32 flex flex-col gap-5">
      {saveToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-slate-100 font-mono font-bold text-xs px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Sticky Bar */}
      <div className="sticky top-13 z-30 bg-slate-950/95 backdrop-blur-md -mx-3 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold font-mono text-slate-200">
            PIT SCOUT: TEAM {teamNumberInput}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSaveTeam}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs uppercase shadow transition-colors active:scale-95 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>Save</span>
        </button>
      </div>

      {/* Team Name */}
      <input
        type="text"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        placeholder="Team name"
        className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
      />

      {/* 1. Drivetrain */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          What drivetrain are you running?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DRIVETRAIN_OPTIONS.map((opt) => {
            const isSelected = drivetrain === opt;
            return (
               <button
                 key={opt}
                 type="button"
                 onClick={() => setDrivetrain(drivetrain === opt ? null : opt)}
                 className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                   isSelected
                     ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                     : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                 }`}
               >
                 {opt}
               </button>
            );
          })}
        </div>

        {drivetrain === 'OTHER' && (
          <input
            type="text"
            value={drivetrainOther}
            onChange={(e) => setDrivetrainOther(e.target.value)}
            placeholder="Specify drivetrain..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* 2. Shooter */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          What kind of shooter do you have?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SHOOTER_OPTIONS.map((opt) => {
            const isSelected = shooter.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleMultiSelect(shooter, opt, setShooter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-slate-300" />}
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {shooter.includes('OTHER') && (
          <input
            type="text"
            value={shooterOther}
            onChange={(e) => setShooterOther(e.target.value)}
            placeholder="Specify shooter..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* 3. Hopper Capacity */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          How much fuel can your hopper hold?
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHopperCapacity(Math.max(0, (typeof hopperCapacity === 'number' ? hopperCapacity : 0) - 5))}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono font-semibold cursor-pointer"
          >
            -5
          </button>
          <button
            type="button"
            onClick={() => setHopperCapacity(Math.max(0, (typeof hopperCapacity === 'number' ? hopperCapacity : 0) - 1))}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <input
            type="number"
            min="0"
            max="100"
            placeholder="0"
            value={hopperCapacity}
            onChange={(e) => {
              const val = e.target.value;
              setHopperCapacity(val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
            }}
            className="w-16 text-center text-base font-mono font-bold bg-slate-950 border border-slate-750 rounded-xl py-1 px-2 text-slate-100 focus:outline-none"
          />
          <span className="text-xs font-mono text-slate-400">fuel</span>

          <button
            type="button"
            onClick={() => setHopperCapacity((typeof hopperCapacity === 'number' ? hopperCapacity : 0) + 1)}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setHopperCapacity((typeof hopperCapacity === 'number' ? hopperCapacity : 0) + 5)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono font-semibold cursor-pointer"
          >
            +5
          </button>
        </div>
      </div>

      {/* 4. Shooting Accuracy */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          About what is your shooting accuracy?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ACCURACY_OPTIONS.map((opt) => {
            const isSelected = shootingAccuracy === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setShootingAccuracy(shootingAccuracy === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Where can you shoot from? */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Where can you shoot from?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SHOOT_FROM_OPTIONS.map((opt) => {
            const isSelected = canShootAnywhere === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setCanShootAnywhere(canShootAnywhere === opt ? '' : opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Bump and Trench */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Can you go over the bump or through the trench?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {BUMP_TRENCH_OPTIONS.map((opt) => {
            const isSelected = bumpTrench === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setBumpTrench(bumpTrench === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Autonomous Capability */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Do you have an autonomous routine?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(['YES', 'NO', 'STILL DEVELOPING'] as const).map((opt) => {
            const isSelected = hasAutonomous === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setHasAutonomous(hasAutonomous === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {hasAutonomous === 'YES' && (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <span className="text-[11px] text-slate-400 block font-medium">
              How many routines got?
            </span>
            <div className="flex gap-1.5">
              {(['1', '2', '3', '4+'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAutoRoutinesCount(autoRoutinesCount === opt ? null : opt)}
                  className={`px-3 py-1 rounded-xl font-semibold text-xs transition-colors cursor-pointer ${
                    autoRoutinesCount === opt
                      ? 'bg-slate-800 text-slate-100 border border-slate-600'
                      : 'bg-slate-950 text-slate-400 border border-slate-850'
                  }`}
                >
                  0{opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 8. Auto Consistency */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          How consistent is your autonomous?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AUTO_CONSISTENCY_OPTIONS.map((opt) => {
            const isSelected = autoConsistency === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setAutoConsistency(autoConsistency === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 9. Biggest Issue */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          What is the biggest issue with your robot?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {BIGGEST_ISSUES_OPTIONS.map((opt) => {
            const isSelected = biggestIssues.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleIssue(opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-slate-300" />}
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {biggestIssues.includes('OTHER') && (
          <input
            type="text"
            value={biggestIssueOther}
            onChange={(e) => setBiggestIssueOther(e.target.value)}
            placeholder="Specify issue details..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* 10. Reliability */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          How reliable would you say the robot is?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {RELIABILITY_OPTIONS.map((opt) => {
            const isSelected = reliability === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setReliability(reliability === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* NOTES */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-1.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Anything else we should know?
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 resize-none"
        />
      </div>

      {/* SAVE & QR */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={handleSaveTeam}
          className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer active:scale-95"
        >
          Save Team {teamNumberInput}
        </button>

        <button
          type="button"
          onClick={handleGenerateSinglePitQr}
          className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-bold text-xs uppercase tracking-wider shadow transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
        >
          <QrCode className="w-4 h-4 text-slate-300" />
          <span>Show QR</span>
        </button>
      </div>

      {/* SINGLE QR MODAL */}
      {isSingleQrOpen && singleQrUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Pit QR: Team #{teamNumberInput}
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
              <img src={singleQrUrl} alt="Single Pit Data QR" className="w-52 h-52 mx-auto" />
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
    </div>
  );
};
