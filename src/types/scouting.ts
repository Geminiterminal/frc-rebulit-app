/**
 * FRC REBUILT Scouting Data Types
 */

export type DrivetrainType = 'SWERVE' | 'TANK / WEST COAST' | 'MECANUM' | 'OTHER';

export type ShooterType = 'FIXED' | 'TURRET' | 'PIVOTING' | 'DUMPER' | 'OTHER';

export type ShootingAccuracy = '<50%' | '50–69%' | '70–84%' | '85–94%' | '95%+' | 'STILL TUNING';

export type BumpTrenchCapability = 'BOTH' | 'BUMP ONLY' | 'TRENCH ONLY' | 'NEITHER';

export type AutoConsistency = 'VERY CONSISTENT' | 'MOSTLY CONSISTENT' | 'SOMETIMES WORKS' | 'RARELY WORKS' | 'STILL TUNING';

export type ReliabilityRating = 'VERY RELIABLE' | 'MOSTLY RELIABLE' | 'SOMEWHAT RELIABLE' | 'UNRELIABLE';

export type BiggestIssue = 
  | 'MECHANICAL' 
  | 'ELECTRICAL' 
  | 'SOFTWARE' 
  | 'SHOOTING' 
  | 'INTAKE' 
  | 'DRIVETRAIN' 
  | 'AUTONOMOUS' 
  | 'ENDGAME' 
  | 'NONE' 
  | 'OTHER';

export interface ShootingZonePoint {
  id: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  label?: string;
  zoneType?: 'trench' | 'hub' | 'bump' | 'protected' | 'open';
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingPath {
  id: string;
  color: string;
  width: number;
  type: 'path' | 'intake' | 'shoot' | 'climb';
  points: DrawingPoint[];
  label?: string;
}

export interface StartPosition {
  x: number;
  y: number;
  angle: number; // heading degrees (0 = up, 90 = right, etc.)
  label?: string;
}

export interface AutonomousDrawing {
  id: string;
  name: string;
  createdAt: number;
  startPosition?: StartPosition;
  paths: DrawingPath[];
  notes?: string;
  thumbnailDataUrl?: string;
}

export interface TeamPhoto {
  id: string;
  dataUrl: string;
  timestamp: number;
  caption?: string;
}

export interface PitData {
  drivetrain?: DrivetrainType;
  drivetrainOther?: string;
  shooter?: ShooterType[];
  shooterOther?: string;
  hopperCapacity?: number;
  shootingAccuracy?: ShootingAccuracy;
  shootingAreas?: ShootingZonePoint[];
  bumpTrench?: BumpTrenchCapability;
  hasAutonomous?: 'YES' | 'NO' | 'STILL DEVELOPING';
  autoRoutinesCount?: '1' | '2' | '3' | '4+';
  autoDrawings?: AutonomousDrawing[];
  autoConsistency?: AutoConsistency;
  biggestIssues?: BiggestIssue[];
  biggestIssueOther?: string;
  reliability?: ReliabilityRating;
  photos?: TeamPhoto[];
  notes?: string;
  scoutName?: string;
  lastUpdated?: number;
}

export type FieldRouteType = 'BUMP' | 'TRENCH' | 'BOTH' | 'NEITHER';
export type DefenseEffectivenessType = 'LOW' | 'MEDIUM' | 'HIGH';
export type RobotIssuesType = 'NONE' | 'MINOR' | 'MAJOR' | 'DISABLED';

export interface MatchScoutingRecord {
  id: string;
  teamNumber: number;
  matchNumber: number;
  timestamp: number;

  // 1. AUTONOMOUS
  autoWorked: boolean;
  autoFuelScored: number;

  // 2. SCORING
  teleopFuelScored: number;

  // 3. FIELD ROUTE
  fieldRoute: FieldRouteType;

  // 4. DEFENSE
  playedDefense: boolean;
  defenseEffectiveness?: DefenseEffectivenessType;

  // 5. ROBOT RELIABILITY
  robotIssues: RobotIssuesType;
  whatHappenedNote?: string;

  // 6. QUICK OBSERVATION
  quickNote?: string;

  // Legacy optional fields for backward compatibility with existing data
  autoHighScored?: number;
  teleopHighScored?: number;
  notes?: string;
  hangStatus?: string;
}

export interface TeamProfile {
  teamNumber: number;
  teamName: string;
  organization?: string;
  location?: string;
  pit?: PitData;
  officialRank?: number;
  stateRank?: number;
  customPicklistRank?: number;
  isUnavailable?: boolean;
  unavailableReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StrategyRobotToken {
  id: string;
  teamNumber: number;
  alliance: 'RED' | 'BLUE';
  x: number;
  y: number;
  role: 'Scorer' | 'Defense' | 'Feeder' | 'Support';
  label: string;
}

export interface StrategyPlan {
  id: string;
  name: string;
  matchNumber?: number;
  redTeams: number[];
  blueTeams: number[];
  tokens: StrategyRobotToken[];
  drawings: DrawingPath[];
  notes: string;
  updatedAt: number;
}

export interface ScoutingDatabaseExport {
  version: number;
  exportedAt: number;
  teams: TeamProfile[];
  matchRecords: MatchScoutingRecord[];
  strategyPlans: StrategyPlan[];
  eventCode: string;
}
