import React, { useState, useEffect, useRef } from 'react';
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
import { ShootingAreaMapper } from '../common/ShootingAreaMapper';
import { AutonomousDrawer } from '../common/AutonomousDrawer';
import { 
  Check, 
  Save, 
  ArrowLeft, 
  Camera, 
  Upload, 
  Trash2, 
  Plus, 
  Minus, 
  X 
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

  const [bumpTrench, setBumpTrench] = useState<BumpTrenchCapability | null>(null);

  const [hasAutonomous, setHasAutonomous] = useState<'YES' | 'NO' | 'STILL DEVELOPING' | null>(null);
  const [autoRoutinesCount, setAutoRoutinesCount] = useState<'1' | '2' | '3' | '4+' | null>(null);
  const [autoDrawings, setAutoDrawings] = useState<AutonomousDrawing[]>([]);

  const [autoConsistency, setAutoConsistency] = useState<AutoConsistency | null>(null);

  const [biggestIssues, setBiggestIssues] = useState<BiggestIssue[]>([]);
  const [biggestIssueOther, setBiggestIssueOther] = useState<string>('');

  const [reliability, setReliability] = useState<ReliabilityRating | null>(null);

  const [photos, setPhotos] = useState<TeamPhoto[]>([]);
  const [notes, setNotes] = useState<string>('');

  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

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
    setBumpTrench(null);
    setHasAutonomous(null);
    setAutoRoutinesCount(null);
    setAutoDrawings([]);
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
          setPhotos((prev) => [...prev, newPhoto]);
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
      onNavigate('team-profile', num);
    }, 1000);
  };

  // STEP 1: Direct team number prompt (Muted, simple)
  if (!teamConfirmed) {
    return (
      <div className="max-w-xs mx-auto px-4 py-12">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 mb-6 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <form onSubmit={handleStartQuestionnaire} className="space-y-4 text-center">
          <div className="text-xs font-mono font-semibold uppercase text-slate-400 tracking-wider">
            TEAM NUMBER
          </div>
          <input
            type="number"
            autoFocus
            required
            placeholder="9751"
            value={teamNumberInput}
            onChange={(e) => setTeamNumberInput(e.target.value)}
            className="w-full text-center text-3xl font-mono font-bold tracking-wider bg-slate-900 border border-slate-750 rounded-xl py-3 px-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500"
          />

          {teamExistsMessage && (
            <div className="text-xs text-slate-400 font-mono">
              {teamExistsMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={!teamNumberInput.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition-colors shadow active:scale-95 cursor-pointer disabled:opacity-40"
          >
            Start
          </button>
        </form>
      </div>
    );
  }

  // QUESTIONNAIRE: Calm dark-mode pills and inputs
  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 pb-24 flex flex-col gap-3">
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs uppercase shadow transition-colors active:scale-95 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
      </div>

      {/* Optional Team Name */}
      <input
        type="text"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        placeholder="Team Name (Optional)"
        className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
      />

      {/* QUESTION 1: Drivetrain */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          1. What is your drivetrain?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DRIVETRAIN_OPTIONS.map((opt) => {
            const isSelected = drivetrain === opt;
            return (
               <button
                 key={opt}
                 type="button"
                 onClick={() => setDrivetrain(drivetrain === opt ? null : opt)}
                 className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                   isSelected
                     ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                     : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
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
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* QUESTION 2: Shooter */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          2. Which is true about your shooter?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SHOOTER_OPTIONS.map((opt) => {
            const isSelected = shooter.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleMultiSelect(shooter, opt, setShooter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
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
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* QUESTION 3: Hopper Capacity */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          3. What is your hopper capacity?
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setHopperCapacity(Math.max(0, (typeof hopperCapacity === 'number' ? hopperCapacity : 0) - 5))}
            className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono font-semibold"
          >
            -5
          </button>
          <button
            type="button"
            onClick={() => setHopperCapacity(Math.max(0, (typeof hopperCapacity === 'number' ? hopperCapacity : 0) - 1))}
            className="p-1 rounded-md bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
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
            className="w-16 text-center text-base font-mono font-bold bg-slate-950 border border-slate-750 rounded-lg py-0.5 px-1 text-slate-100 focus:outline-none placeholder-slate-600"
          />

          <button
            type="button"
            onClick={() => setHopperCapacity((typeof hopperCapacity === 'number' ? hopperCapacity : 0) + 1)}
            className="p-1 rounded-md bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setHopperCapacity((typeof hopperCapacity === 'number' ? hopperCapacity : 0) + 5)}
            className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono font-semibold"
          >
            +5
          </button>
        </div>
      </div>

      {/* QUESTION 4: Shooting Accuracy */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          4. What is your shooting accuracy?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ACCURACY_OPTIONS.map((opt) => {
            const isSelected = shootingAccuracy === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setShootingAccuracy(shootingAccuracy === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* QUESTION 5: Shooting Area */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          5. What is your shooting area?
        </label>
        <ShootingAreaMapper
          zones={shootingAreas}
          onChange={setShootingAreas}
        />
      </div>

      {/* QUESTION 6: Bump and Trench */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          6. Can you use both Bump and Trench?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {BUMP_TRENCH_OPTIONS.map((opt) => {
            const isSelected = bumpTrench === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setBumpTrench(bumpTrench === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* QUESTION 7: Autonomous */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          7. Do you have autonomous?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(['YES', 'NO', 'STILL DEVELOPING'] as const).map((opt) => {
            const isSelected = hasAutonomous === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setHasAutonomous(hasAutonomous === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
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
                  className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors ${
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
      {hasAutonomous !== 'NO' && (
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <label className="text-xs font-semibold text-slate-200 block">
            8. Please draw your autonomous.
          </label>
          <AutonomousDrawer
            drawing={autoDrawings[0]}
            onSave={(newDrawing) => {
              setAutoDrawings([newDrawing]);
            }}
          />
        </div>
      )}

      {/* QUESTION 9: Autonomous Consistency */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          9. How consistent is your autonomous?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AUTO_CONSISTENCY_OPTIONS.map((opt) => {
            const isSelected = autoConsistency === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setAutoConsistency(autoConsistency === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* QUESTION 10: Biggest Issue */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          10. What has been your biggest issue?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {BIGGEST_ISSUES_OPTIONS.map((opt) => {
            const isSelected = biggestIssues.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleIssue(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
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
            placeholder="Specify issue..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* QUESTION 11: Reliability */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          11. How reliable is the robot now?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {RELIABILITY_OPTIONS.map((opt) => {
            const isSelected = reliability === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setReliability(reliability === opt ? null : opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* PHOTOS */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200 block">
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
            className="flex-1 py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span>Take Photo</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Add Photo</span>
          </button>
        </div>

        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {photos.map((p, idx) => (
              <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-800 aspect-square bg-slate-950">
                <img
                  src={p.dataUrl}
                  alt={`Robot ${idx + 1}`}
                  onClick={() => setPreviewPhoto(p.dataUrl)}
                  className="w-full h-full object-cover cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((item) => item.id !== p.id))}
                  className="absolute top-1 right-1 p-1 rounded bg-black/80 text-white hover:bg-rose-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OPTIONAL NOTES */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
        <label className="text-xs font-semibold text-slate-200 block">
          Notes (Optional)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else we should know..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 resize-none"
        />
      </div>

      {/* SAVE TEAM BUTTON */}
      <button
        type="button"
        onClick={handleSaveTeam}
        className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer active:scale-95"
      >
        Save Team {teamNumberInput}
      </button>

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
