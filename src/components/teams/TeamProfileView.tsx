import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord, AutonomousDrawing } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { ShootingAreaMapper } from '../common/ShootingAreaMapper';
import { AutonomousDrawer } from '../common/AutonomousDrawer';
import { 
  ArrowLeft, 
  Edit3, 
  Gamepad2, 
  Camera, 
  MapPin, 
  ShieldCheck, 
  AlertTriangle, 
  Star, 
  CheckCircle2, 
  Flame, 
  Layers, 
  ChevronRight,
  Maximize2,
  X,
  Target
} from 'lucide-react';

interface TeamProfileViewProps {
  teamNumber: number;
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const TeamProfileView: React.FC<TeamProfileViewProps> = ({
  teamNumber,
  onNavigate,
}) => {
  const [team, setTeam] = useState<TeamProfile | null>(null);
  const [matches, setMatches] = useState<MatchScoutingRecord[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'pit' | 'auto' | 'matches' | 'photos'>('overview');
  const [activeAutoRoutineIdx, setActiveAutoRoutineIdx] = useState<number>(0);

  useEffect(() => {
    loadTeamData();
  }, [teamNumber]);

  const loadTeamData = async () => {
    const profile = await scoutingDB.getTeam(teamNumber);
    if (profile) {
      setTeam(profile);
    } else {
      // Create empty placeholder if not found
      setTeam({
        teamNumber,
        teamName: `Team ${teamNumber}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const teamMatches = await scoutingDB.getMatchesForTeam(teamNumber);
    setMatches(teamMatches);
  };

  if (!team) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-slate-400">
        Loading Team {teamNumber}...
      </div>
    );
  }

  // Calculate Match Scouting Averages
  const matchCount = matches.length;
  const avgAutoFuel = matchCount ? (matches.reduce((acc, m) => acc + (m.autoFuelScored ?? m.autoHighScored ?? 0), 0) / matchCount).toFixed(1) : '0';
  const avgTeleopFuel = matchCount ? (matches.reduce((acc, m) => acc + (m.teleopFuelScored ?? m.teleopHighScored ?? 0), 0) / matchCount).toFixed(1) : '0';
  const defenseMatchesCount = matches.filter((m) => m.playedDefense).length;

  const pit = team.pit;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28 flex flex-col gap-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('teams')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Teams</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('pit-scout', teamNumber)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Pit Data</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('match-scout', teamNumber)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Scout Match</span>
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl sm:text-4xl font-mono font-black text-slate-100 tracking-tight">
              TEAM {team.teamNumber}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono text-xs font-bold">
              {pit?.drivetrain || 'No Pit Data'}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono text-xs font-bold">
              {team.officialRank ? `Event Rank: ${team.officialRank}` : 'Event Rank: N/A'}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-blue-950/80 text-blue-300 border border-blue-800/80 font-mono text-xs font-bold">
              {team.stateRank ? `State Rank: ${team.stateRank}` : 'State Rank: N/A'}
            </span>
            {team.customPicklistRank && (
              <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold">
                Pref #{team.customPicklistRank}
              </span>
            )}
            {team.isUnavailable && (
              <span className="px-2.5 py-1 rounded-md bg-rose-950 text-rose-300 border border-rose-800 font-mono text-xs font-bold uppercase">
                PICKED / UNAVAILABLE
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-slate-400 mt-1">
            {team.teamName}
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400 font-mono text-[10px] uppercase">Matches</div>
            <div className="text-xl font-mono font-bold text-slate-200 mt-0.5">{matchCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400 font-mono text-[10px] uppercase">Avg Auto Fuel</div>
            <div className="text-xl font-mono font-bold text-blue-400 mt-0.5">{avgAutoFuel}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400 font-mono text-[10px] uppercase">Avg Teleop Fuel</div>
            <div className="text-xl font-mono font-bold text-emerald-400 mt-0.5">{avgTeleopFuel}</div>
          </div>
        </div>
      </div>

      {/* Alliance Warning Banner */}
      <div className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong>Alliance Rule:</strong> Pit info represents team claims. Match scouting represents verified observations.
          </span>
        </div>
      </div>

      {/* SECTION 1: PIT INFORMATION */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            PIT INFORMATION (Team Claims)
          </h2>
          {pit ? (
            <span className="text-xs text-slate-400 font-mono">
              {pit.lastUpdated ? `Updated ${new Date(pit.lastUpdated).toLocaleDateString()}` : 'Pit Scouting Recorded'}
            </span>
          ) : (
            <span className="text-xs text-rose-400 font-mono">Needs Pit Scouting</span>
          )}
        </div>

        {pit ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 uppercase font-mono block text-[10px]">Drivetrain</span>
              <span className="font-bold text-sm text-white mt-0.5 block">
                {pit.drivetrain || '—'} {pit.drivetrainOther && `(${pit.drivetrainOther})`}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 uppercase font-mono block text-[10px]">Shooter Type</span>
              <span className="font-bold text-sm text-blue-400 mt-0.5 block">
                {pit.shooter && pit.shooter.length > 0 ? pit.shooter.join(', ') : '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 uppercase font-mono block text-[10px]">Hopper Capacity</span>
              <span className="font-bold text-sm text-amber-400 mt-0.5 block">
                {pit.hopperCapacity !== undefined ? `${pit.hopperCapacity} balls` : '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 uppercase font-mono block text-[10px]">Shooting Accuracy</span>
              <span className="font-bold text-sm text-emerald-400 mt-0.5 block">
                {pit.shootingAccuracy || '—'}
              </span>
            </div>

            {pit.canShootAnywhere && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 uppercase font-mono block text-[10px]">Shoot From Turret/Fixed</span>
                <span className="font-bold text-sm text-sky-400 mt-0.5 block">
                  {pit.canShootAnywhere}
                </span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 uppercase font-mono block text-[10px]">Bump / Trench</span>
              <span className="font-bold text-sm text-white mt-0.5 block">
                {pit.bumpTrench || '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 uppercase font-mono block text-[10px]">Autonomous Routines</span>
              <span className="font-bold text-sm text-purple-400 mt-0.5 block">
                {pit.hasAutonomous === 'YES' ? `${pit.autoRoutinesCount || '1'} routine(s)` : (pit.hasAutonomous || '—')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 uppercase font-mono block text-[10px]">Auto Consistency</span>
              <span className="font-bold text-sm text-white mt-0.5 block">
                {pit.autoConsistency || '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 uppercase font-mono block text-[10px]">Biggest Issues</span>
              <span className="font-bold text-sm text-amber-300 mt-0.5 block">
                {pit.biggestIssues && pit.biggestIssues.length > 0 ? pit.biggestIssues.join(', ') : 'None'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 uppercase font-mono block text-[10px]">Current Reliability</span>
              <span className="font-bold text-sm text-emerald-300 mt-0.5 block">
                {pit.reliability || '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm mb-3">No pit questionnaire data collected yet.</p>
            <button
              onClick={() => onNavigate('pit-scout', teamNumber)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-wider"
            >
              Start Pit Questionnaire
            </button>
          </div>
        )}

        {/* Optional Pit Notes */}
        {pit?.notes && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
            <span className="font-bold text-slate-400 uppercase font-mono block text-[10px] mb-1">
              Scout Pit Notes
            </span>
            <p>{pit.notes}</p>
          </div>
        )}
      </div>

      {/* SECTION 2: SHOOTING AREA & AUTONOMOUS DRAWING MAPS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Shooting Area Map */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4 text-sky-400" />
              <span>Shooting Area (Field Map)</span>
            </h3>
            <span className="text-xs text-sky-400 font-mono">
              {pit?.shootingAreas?.length || 0} spots
            </span>
          </div>

          {pit?.shootingAreas && pit.shootingAreas.length > 0 ? (
            <ShootingAreaMapper
              zones={pit.shootingAreas}
              onChange={() => {}}
              readOnly={true}
            />
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-xl border border-slate-800/60">
              {pit?.canShootAnywhere ? (
                <div className="space-y-1">
                  <span className="text-slate-400 font-mono block uppercase text-[10px]">Shooting Position (No Map):</span>
                  <span className="font-bold text-sm text-sky-400">{pit.canShootAnywhere}</span>
                </div>
              ) : (
                "No shooting area marked yet in pit scouting."
              )}
            </div>
          )}
        </div>

        {/* Autonomous Routine Drawing */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Autonomous Routines</span>
            </h3>
            <span className="text-xs text-emerald-400 font-mono">
              {pit?.autoDrawings?.length || 0} Routine{(pit?.autoDrawings?.length || 0) === 1 ? '' : 's'}
            </span>
          </div>

          {pit?.autoDrawings && pit.autoDrawings.length > 0 ? (
            <div className="space-y-3">
              {/* Routine Tab selector if multiple routines */}
              {pit.autoDrawings.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {pit.autoDrawings.map((routine, idx) => {
                    const isSelected = activeAutoRoutineIdx === idx;
                    return (
                      <button
                        key={routine.id || idx}
                        type="button"
                        onClick={() => setActiveAutoRoutineIdx(idx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-700/80'
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-900 hover:text-slate-300'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{routine.name || `Routine ${idx + 1}`}</span>
                        {routine.paths && routine.paths.length > 0 && (
                          <span className="text-[10px] px-1 rounded bg-slate-900 text-slate-400 font-mono">
                            {routine.paths.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active Routine Canvas & Details */}
              {(() => {
                const currentDrawing = pit.autoDrawings[activeAutoRoutineIdx] || pit.autoDrawings[0];
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-bold text-white font-mono">
                        {currentDrawing.name || `Routine ${activeAutoRoutineIdx + 1}`}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {currentDrawing.paths?.length || 0} path segments
                      </span>
                    </div>

                    <AutonomousDrawer
                      key={currentDrawing.id || activeAutoRoutineIdx}
                      drawing={currentDrawing}
                      readOnly={true}
                    />

                    {currentDrawing.notes && (
                      <div className="p-2.5 rounded-lg bg-slate-950 text-slate-300 text-xs border border-slate-800">
                        <span className="font-bold text-slate-400 text-[10px] uppercase font-mono block">
                          Routine Notes:
                        </span>
                        {currentDrawing.notes}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-xl border border-slate-800/60">
              No autonomous path drawn yet.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: ROBOT PHOTOS */}
      {pit?.photos && pit.photos.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-400" />
              <span>Robot Photos ({pit.photos.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {pit.photos.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => setSelectedPhoto(p.dataUrl)}
                className="relative group rounded-xl overflow-hidden border border-slate-700 aspect-video bg-slate-950 cursor-pointer"
              >
                <img src={p.dataUrl} alt={`Robot ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <Maximize2 className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: MATCH OBSERVATIONS (VERIFIED SCOUTING) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              MATCH OBSERVATIONS ({matchCount} Matches)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Empirical data observed by scouts in qualification & playoff matches.
            </p>
          </div>
          <button
            onClick={() => onNavigate('match-scout', teamNumber)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase"
          >
            + Add Match
          </button>
        </div>

        {matchCount > 0 ? (
          <div className="space-y-3">
            {matches.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">
                      Match {m.matchNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                      m.autoWorked !== false ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {m.autoWorked !== false ? 'Auto Worked' : 'Auto Failed'}
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px] font-mono">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-slate-300 pt-0.5">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono">
                    Auto Fuel: <strong className="text-blue-400">{m.autoFuelScored ?? m.autoHighScored ?? 0}</strong>
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono">
                    Teleop Fuel: <strong className="text-emerald-400">{m.teleopFuelScored ?? m.teleopHighScored ?? 0}</strong>
                  </span>
                  {m.fieldRoute && (
                    <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono">
                      Route: <strong className="text-purple-300">{m.fieldRoute}</strong>
                    </span>
                  )}
                  {m.playedDefense && (
                    <span className="px-2 py-1 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                      Defense: {m.defenseEffectiveness || 'YES'}
                    </span>
                  )}
                  {m.robotIssues && m.robotIssues !== 'NONE' && (
                    <span className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold font-mono">
                      Issue: {m.robotIssues} {m.whatHappenedNote && `(${m.whatHappenedNote})`}
                    </span>
                  )}
                </div>

                {(m.quickNote || m.notes) && (
                  <p className="text-slate-400 italic pt-0.5">"{m.quickNote || m.notes}"</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-950 rounded-xl border border-slate-800/80">
            <p className="text-slate-400 text-xs">No match observations recorded for Team {teamNumber} yet.</p>
          </div>
        )}
      </div>

      {/* Lightbox photo preview */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 p-4 flex items-center justify-center backdrop-blur-md cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh]">
            <img src={selectedPhoto} alt="Full view" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/80 text-white hover:bg-slate-800"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
