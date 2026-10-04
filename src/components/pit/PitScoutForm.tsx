import React, { useState, useEffect, useRef } from 'react';
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
  ReliabilityRating,
  ShootingZonePoint,
  AutonomousDrawing,
  TeamPhoto
} from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { scoutingAssignments } from '../../db/scoutingAssignments';
import { qrTransferEngine } from '../../utils/qrTransferEngine';
import { ShootingAreaMapper } from '../common/ShootingAreaMapper';
import { AutonomousDrawer } from '../common/AutonomousDrawer';
import { ScoutingAssignmentsCard } from '../scouting/ScoutingAssignmentsCard';
import { 
  Check, 
  Save, 
  ArrowLeft, 
  Camera, 
  Upload, 
  Trash2, 
  Plus, 
  Minus, 
  X,
  QrCode
} from 'lucide-react';

interface PitScoutFormProps {
  initialTeamNumber?: number;
  onNavigate: (view: string, teamNumber?: number) => void;
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
  'STILL TUNING',
];

const BUMP_TRENCH_OPTIONS: BumpTrenchCapability[] = [
  'BOTH',
  'BUMP ONLY',
  'TRENCH ONLY',
  'NEITHER',
];

const AUTO_CONSISTENCY_OPTIONS: AutoConsistency[] = [
  'VERY CONSISTENT',
  'MOSTLY CONSISTENT',
  'SOMETIMES WORKS',
  'RARELY WORKS',
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
  const [shootingAreas, setShootingAreas] = useState<ShootingZonePoint[]>([]);
  const [canShootAnywhere, setCanShootAnywhere] = useState<string>('');

  const [bumpTrench, setBumpTrench] = useState<BumpTrenchCapability | null>(null);

  const [hasAutonomous, setHasAutonomous] = useState<'YES' | 'NO' | 'STILL DEVELOPING' | null>(null);
  const [autoRoutinesCount, setAutoRoutinesCount] = useState<'1' | '2' | '3' | '4+' | null>(null);
  const [autoDrawings, setAutoDrawings] = useState<AutonomousDrawing[]>([]);
  const [activeRoutineIndex, setActiveRoutineIndex] = useState<number>(0);

  const [autoConsistency, setAutoConsistency] = useState<AutoConsistency | null>(null);

  const [biggestIssues, setBiggestIssues] = useState<BiggestIssue[]>([]);
  const [biggestIssueOther, setBiggestIssueOther] = useState<string>('');

  const [reliability, setReliability] = useState<ReliabilityRating | null>(null);

  const [photos, setPhotos] = useState<TeamPhoto[]>([]);
  const [notes, setNotes] = useState<string>('');

  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const [isSingleQrOpen, setIsSingleQrOpen] = useState<boolean>(false);
  const [singleQrUrl, setSingleQrUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetToBlankState = () => {
    setTeamName('');
    setDrivetrain(null);
    setDrivetrainOther('');
    setShooter([]);
    setShooterOther('');
    setHopperCapacity('');
    setShootingAccuracy(null);
    setShootingAreas([]);
    setCanShootAnywhere('');
    setBumpTrench(null);
    setHasAutonomous(null);
    setAutoRoutinesCount(null);
    setAutoDrawings([]);
    setActiveRoutineIndex(0);
    setAutoConsistency(null);
    setBiggestIssues([]);
    setBiggestIssueOther('');
    setReliability(null);
    setPhotos([]);
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
      setShootingAreas(t.pit.shootingAreas || []);
      setCanShootAnywhere(t.pit.canShootAnywhere || '');
      setBumpTrench(t.pit.bumpTrench || null);
      setHasAutonomous(t.pit.hasAutonomous || null);
      setAutoRoutinesCount(t.pit.autoRoutinesCount || null);
      setAutoDrawings(t.pit.autoDrawings || []);
      setAutoConsistency(t.pit.autoConsistency || null);
      setBiggestIssues(t.pit.biggestIssues || []);
      setBiggestIssueOther(t.pit.biggestIssueOther || '');
      setReliability(t.pit.reliability || null);
      setPhotos(t.pit.photos || []);
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

  const handlePhotoFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          const newPhoto: TeamPhoto = {
            id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            dataUrl,
            timestamp: Date.now(),
          };
          setPhotos((prev) => {
            const updated = [...prev, newPhoto];
            localStorage.setItem(`team_photo_${newPhoto.id}`, dataUrl);
            return updated;
          });
        }
      };
      reader.readAsDataURL(file);
    });
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
      shootingAreas,
      canShootAnywhere: canShootAnywhere || undefined,
      bumpTrench: bumpTrench || undefined,
      hasAutonomous: hasAutonomous || undefined,
      autoRoutinesCount: hasAutonomous === 'YES' ? (autoRoutinesCount || undefined) : undefined,
      autoDrawings,
      autoConsistency: autoConsistency || undefined,
      biggestIssues: biggestIssues.length > 0 ? biggestIssues : undefined,
      biggestIssueOther: biggestIssues.includes('OTHER') ? biggestIssueOther : undefined,
      reliability: reliability || undefined,
      photos,
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
      shootingAreas,
      canShootAnywhere: canShootAnywhere || undefined,
      bumpTrench: bumpTrench || undefined,
      hasAutonomous: hasAutonomous || undefined,
      autoRoutinesCount: hasAutonomous === 'YES' ? (autoRoutinesCount || undefined) : undefined,
      autoDrawings,
      autoConsistency: autoConsistency || undefined,
      biggestIssues: biggestIssues.length > 0 ? biggestIssues : undefined,
      biggestIssueOther: biggestIssues.includes('OTHER') ? biggestIssueOther : undefined,
      reliability: reliability || undefined,
      photos,
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

  const isMapHidden = localStorage.getItem('hide_map') !== 'false';

  return (
    <div className="max-w-xl mx-auto px-3.5 sm:px-5 py-4 pb-32 flex flex-col gap-5">
      {/* Sticky Bar */}
      <div className="sticky top-13 z-30 bg-slate-950/95 backdrop-blur-md -mx-3 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold font-mono text-slate-200">
            TEAM {teamNumberInput}
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

      {/* QUESTION 1: Drivetrain */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Drivetrain
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
            placeholder="Drivetrain details"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* QUESTION 2: Shooter */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Shooter Type
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
            placeholder="Shooter details"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* QUESTION 3: Hopper Capacity */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Hopper Capacity
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHopperCapacity(Math.max(0, (typeof hopperCapacity === 'number' ? hopperCapacity : 0) - 5))}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono font-semibold"
          >
            -5
          </button>
          <button
            type="button"
            onClick={() => setHopperCapacity(Math.max(0, (typeof hopperCapacity === 'number' ? hopperCapacity : 0) - 1))}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
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

          <button
            type="button"
            onClick={() => setHopperCapacity((typeof hopperCapacity === 'number' ? hopperCapacity : 0) + 1)}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setHopperCapacity((typeof hopperCapacity === 'number' ? hopperCapacity : 0) + 5)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono font-semibold"
          >
            +5
          </button>
        </div>
      </div>

      {/* QUESTION 4: Shooting Accuracy */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Shooting Accuracy
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

      {/* QUESTION 5: Shooting Area */}
      {isMapHidden ? (
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
          <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
            Shooting Positions
          </label>
          <div className="flex flex-wrap gap-1.5">
            {['YES', 'NO', 'FIXED ONLY', 'TURRET ONLY', 'TUNING'].map((opt) => {
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
          <input
            type="text"
            value={canShootAnywhere}
            onChange={(e) => setCanShootAnywhere(e.target.value)}
            placeholder="Shooting positions..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
          <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
            Shooting Area (Field Map)
          </label>
          <ShootingAreaMapper
            zones={shootingAreas}
            onChange={setShootingAreas}
            isHidden={false}
          />
        </div>
      )}

      {/* QUESTION 6: Bump and Trench */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Bump and Trench
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

      {/* QUESTION 7: Autonomous */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Autonomous Capability
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
              Routines count:
            </span>
            <div className="flex gap-1.5">
              {(['1', '2', '3', '4+'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAutoRoutinesCount(autoRoutinesCount === opt ? null : opt)}
                  className={`px-3 py-1 rounded-xl font-semibold text-xs transition-colors ${
                    autoRoutinesCount === opt
                      ? 'bg-slate-800 text-slate-100 border border-slate-600'
                      : 'bg-slate-950 text-slate-400 border border-slate-850'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QUESTION 8: Autonomous Drawing */}
      {!isMapHidden && hasAutonomous !== 'NO' && (
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
              Autonomous Routines
            </label>
            <span className="text-xs font-mono text-slate-400">
              {autoDrawings.length} Routine{autoDrawings.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {autoDrawings.map((routine, idx) => {
              const isSelected = activeRoutineIndex === idx;
              return (
                <button
                  key={routine.id || idx}
                  type="button"
                  onClick={() => setActiveRoutineIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                  }`}
                >
                  <span>{routine.name || `Routine ${idx + 1}`}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                const nextNum = autoDrawings.length + 1;
                const newRoutine: AutonomousDrawing = {
                  id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                  name: `Routine ${nextNum}`,
                  createdAt: Date.now(),
                  paths: [],
                  startPosition: { x: 50, y: 15, angle: 180, label: 'Start' },
                };
                const updated = [...autoDrawings, newRoutine];
                setAutoDrawings(updated);
                setActiveRoutineIndex(updated.length - 1);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              <span>Add Routine</span>
            </button>
          </div>

          {(() => {
            const currentRoutine: AutonomousDrawing = autoDrawings[activeRoutineIndex] || {
              id: `auto-default-${Date.now()}`,
              name: `Routine 1`,
              createdAt: Date.now(),
              paths: [],
              startPosition: { x: 50, y: 15, angle: 180, label: 'Start' },
            };

            const handleSaveCurrentRoutine = (updated: AutonomousDrawing) => {
              if (autoDrawings.length === 0) {
                setAutoDrawings([updated]);
                setActiveRoutineIndex(0);
                return;
              }
              const next = [...autoDrawings];
              next[activeRoutineIndex] = updated;
              setAutoDrawings(next);
            };

            const handleRoutineNameChange = (newName: string) => {
              const updated = { ...currentRoutine, name: newName };
              handleSaveCurrentRoutine(updated);
            };

            const handleRoutineNotesChange = (newNotes: string) => {
              const updated = { ...currentRoutine, notes: newNotes };
              handleSaveCurrentRoutine(updated);
            };

            const handleDeleteCurrentRoutine = () => {
              if (autoDrawings.length <= 1) {
                const resetRoutine: AutonomousDrawing = {
                  id: `auto-${Date.now()}`,
                  name: 'Routine 1',
                  createdAt: Date.now(),
                  paths: [],
                  startPosition: { x: 50, y: 15, angle: 180, label: 'Start' },
                };
                setAutoDrawings([resetRoutine]);
                setActiveRoutineIndex(0);
                return;
              }
              const next = autoDrawings.filter((_, i) => i !== activeRoutineIndex);
              setAutoDrawings(next);
              setActiveRoutineIndex(Math.max(0, activeRoutineIndex - 1));
            };

            return (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={currentRoutine.name || ''}
                      onChange={(e) => handleRoutineNameChange(e.target.value)}
                      placeholder="Routine name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 font-medium"
                    />
                  </div>

                  {autoDrawings.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteCurrentRoutine}
                      className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 text-xs transition-colors"
                      title="Delete routine"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <AutonomousDrawer
                  key={currentRoutine.id || activeRoutineIndex}
                  drawing={currentRoutine}
                  onSave={handleSaveCurrentRoutine}
                />

                <input
                  type="text"
                  value={currentRoutine.notes || ''}
                  onChange={(e) => handleRoutineNotesChange(e.target.value)}
                  placeholder="Routine notes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* QUESTION 9: Autonomous Consistency */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Auto Consistency
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

      {/* QUESTION 10: Biggest Issue */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Known Issues
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
            placeholder="Issue details"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* QUESTION 11: Reliability */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Robot Reliability
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

      {/* PHOTOS */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
            Photos
          </label>
          {photos.length > 0 && (
            <span className="text-xs text-slate-500 font-mono">{photos.length}</span>
          )}
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handlePhotoFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handlePhotoFiles(e.target.files)}
          className="hidden"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span>Take Photo</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Add Photo</span>
          </button>
        </div>

        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {photos.map((p, idx) => (
              <div key={p.id} className="relative group rounded-xl overflow-hidden border border-slate-800 aspect-square bg-slate-950">
                <img
                  src={p.dataUrl}
                  alt={`Robot ${idx + 1}`}
                  onClick={() => setPreviewPhoto(p.dataUrl)}
                  className="w-full h-full object-cover cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((item) => item.id !== p.id))}
                  className="absolute top-1 right-1 p-1 rounded-md bg-black/80 text-white hover:bg-rose-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NOTES */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-1.5">
        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block font-mono">
          Notes
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
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

      {/* Toast */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs px-4 py-2 rounded-lg shadow-xl flex items-center gap-1.5 animate-bounce">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Fullscreen Photo */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 p-4 flex items-center justify-center cursor-pointer"
        >
          <div className="relative max-w-xl max-h-[85vh]">
            <img src={previewPhoto} alt="Full view" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
