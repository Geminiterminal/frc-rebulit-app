import React from 'react';

interface RebuiltFieldSvgProps {
  className?: string;
  children?: React.ReactNode;
}

export const RebuiltFieldSvg: React.FC<RebuiltFieldSvgProps> = ({ className = '', children }) => {
  return (
    <div className={`relative select-none overflow-hidden rounded-xl border border-slate-800 bg-[#090c15] ${className}`}>
      <svg
        viewBox="0 0 500 1000"
        className="w-full h-auto block"
        style={{ touchAction: 'none' }}
      >
        <defs>
          <radialGradient id="hubTargetBlue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.1" />
          </radialGradient>
          <radialGradient id="hubTargetRed" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#991b1b" stopOpacity="0.1" />
          </radialGradient>
          <filter id="tokenShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Field Floor */}
        <rect width="500" height="1000" fill="#090c15" />

        {/* Outer Perimeter Border */}
        <rect x="10" y="40" width="480" height="930" fill="none" stroke="#334155" strokeWidth="2.5" rx="4" />

        {/* Center Longitudinal Cable Runner Line */}
        <line x1="250" y1="40" x2="250" y2="970" stroke="#1e293b" strokeWidth="3" />

        {/* Center Field Line */}
        <line x1="10" y1="500" x2="490" y2="500" stroke="#475569" strokeWidth="2" />

        {/* ================= BLUE ALLIANCE (UPPER HALF) ================= */}
        {/* Top alliance station */}
        <rect x="195" y="40" width="110" height="55" fill="#0f172a" />
        <line x1="190" y1="95" x2="310" y2="95" stroke="#2563eb" strokeWidth="4" />
        <line x1="190" y1="88" x2="190" y2="98" stroke="#2563eb" strokeWidth="3" />
        <line x1="310" y1="88" x2="310" y2="98" stroke="#2563eb" strokeWidth="3" />

        {/* Blue Loading Bay / Corral with power cells (Top Right) */}
        <rect x="325" y="42" width="60" height="42" fill="#0f172a" stroke="#1d4ed8" strokeWidth="2" />
        {/* 4x5 balls in loading bay */}
        <g fill="#facc15" stroke="#ca8a04" strokeWidth="0.8">
          {[49, 57, 65, 73].map((cy) =>
            [333, 343, 353, 363, 373].map((cx) => (
              <circle key={`bay-b-${cx}-${cy}`} cx={cx} cy={cy} r="3.2" />
            ))
          )}
        </g>

        {/* Top Left alliance wall balls */}
        <g fill="#facc15" stroke="#ca8a04" strokeWidth="0.8">
          {[30, 38, 46, 54, 62].map((cx) => (
            <circle key={`wall-top-${cx}`} cx={cx} cy="35" r="3.2" />
          ))}
        </g>

        {/* Blue Trench Run & Bump Lines */}
        <line x1="10" y1="265" x2="490" y2="265" stroke="#1e293b" strokeWidth="2" />
        <line x1="10" y1="300" x2="490" y2="300" stroke="#1e40af" strokeWidth="2.5" />

        {/* Blue Structure / Shield Generator Truss & Hub (y: 265 to 335) */}
        <rect x="85" y="265" width="330" height="70" fill="#0f172a" stroke="#1e3a8a" strokeWidth="2" />
        {/* Structure Pillars / Bumps */}
        <rect x="85" y="260" width="18" height="80" fill="#1e293b" />
        <rect x="397" y="260" width="18" height="80" fill="#1e293b" />
        {/* Mid dividing line in blue structure */}
        <line x1="85" y1="300" x2="415" y2="300" stroke="#2563eb" strokeWidth="1.5" />

        {/* Blue Hexagon Center Hub with target rings */}
        <polygon points="250,268 282,284 282,316 250,332 218,316 218,284" fill="url(#hubTargetBlue)" stroke="#3b82f6" strokeWidth="2" />
        <circle cx="250" cy="300" r="14" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
        <circle cx="250" cy="300" r="6" fill="none" stroke="#93c5fd" strokeWidth="1.5" />
        <circle cx="250" cy="300" r="2.5" fill="#ffffff" />

        {/* ================= CENTER FUEL / RENDEZVOUS GRID (y around 500) ================= */}
        <g fill="#facc15" stroke="#ca8a04" strokeWidth="0.8">
          {/* Left block: 10 cols x 5 rows */}
          {[455, 475, 495, 515, 535].map((cy) =>
            [115, 128, 141, 154, 167, 180, 193, 206, 219, 232].map((cx) => (
              <circle key={`cell-l-${cx}-${cy}`} cx={cx} cy={cy} r="4" />
            ))
          )}
          {/* Right block: 10 cols x 5 rows */}
          {[455, 475, 495, 515, 535].map((cy) =>
            [268, 281, 294, 307, 320, 333, 346, 359, 372, 385].map((cx) => (
              <circle key={`cell-r-${cx}-${cy}`} cx={cx} cy={cy} r="4" />
            ))
          )}
        </g>

        {/* Dashed center guideline over fuel */}
        <line x1="100" y1="500" x2="400" y2="500" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4" />

        {/* ================= RED ALLIANCE (LOWER HALF) ================= */}
        {/* Red Trench Run & Bump Lines */}
        <line x1="10" y1="708" x2="490" y2="708" stroke="#3b1414" strokeWidth="2" />
        <line x1="10" y1="742" x2="490" y2="742" stroke="#b91c1c" strokeWidth="2.5" />

        {/* Red Structure / Shield Generator Truss & Hub (y: 675 to 745) */}
        <rect x="85" y="675" width="330" height="70" fill="#1e1313" stroke="#7f1d1d" strokeWidth="2" />
        {/* Structure Pillars / Bumps */}
        <rect x="85" y="670" width="18" height="80" fill="#2d1717" />
        <rect x="397" y="670" width="18" height="80" fill="#2d1717" />
        {/* Mid dividing line in red structure */}
        <line x1="85" y1="710" x2="415" y2="710" stroke="#dc2626" strokeWidth="1.5" />

        {/* Red Hexagon Center Hub with target rings */}
        <polygon points="250,678 282,694 282,726 250,742 218,726 218,694" fill="url(#hubTargetRed)" stroke="#ef4444" strokeWidth="2" />
        <circle cx="250" cy="710" r="14" fill="none" stroke="#f87171" strokeWidth="1.5" />
        <circle cx="250" cy="710" r="6" fill="none" stroke="#fca5a5" strokeWidth="1.5" />
        <circle cx="250" cy="710" r="2.5" fill="#ffffff" />

        {/* Red Loading Bay / Corral with power cells (Bottom Left) */}
        <rect x="115" y="930" width="60" height="42" fill="#1e1313" stroke="#b91c1c" strokeWidth="2" />
        <g fill="#facc15" stroke="#ca8a04" strokeWidth="0.8">
          {[937, 945, 953, 961].map((cy) =>
            [123, 133, 143, 153, 163].map((cx) => (
              <circle key={`bay-r-${cx}-${cy}`} cx={cx} cy={cy} r="3.2" />
            ))
          )}
        </g>

        {/* Bottom alliance station */}
        <rect x="195" y="915" width="110" height="55" fill="#0f172a" />
        <line x1="190" y1="910" x2="310" y2="910" stroke="#dc2626" strokeWidth="4" />
        <line x1="190" y1="904" x2="190" y2="914" stroke="#dc2626" strokeWidth="3" />
        <line x1="310" y1="904" x2="310" y2="914" stroke="#dc2626" strokeWidth="3" />

        {/* Bottom Right alliance wall balls */}
        <g fill="#facc15" stroke="#ca8a04" strokeWidth="0.8">
          {[438, 446, 454, 462, 470].map((cx) => (
            <circle key={`wall-bottom-${cx}`} cx={cx} cy="975" r="3.2" />
          ))}
        </g>

        {/* Dynamic Interactive Children Layers (Shooting Zones, Auto paths, Tokens) */}
        {children}
      </svg>
    </div>
  );
};
