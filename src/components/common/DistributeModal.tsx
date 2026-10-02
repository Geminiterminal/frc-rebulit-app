import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Share2, 
  Copy, 
  Check, 
  X, 
  Smartphone, 
  Download, 
  WifiOff, 
  QrCode, 
  Users,
  ExternalLink
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface DistributeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DistributeModal: React.FC<DistributeModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'qr' | 'install' | 'sync'>('qr');
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // App URL: uses window location or the live preview URL
  const appUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : 'https://ais-pre-27hmo44gflkrnhx5b6rd2h-409583014220.us-west2.run.app';

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(appUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code', err));
    }
  }, [isOpen, appUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(appUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = appUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FRC REBUILT Scouting App',
          text: 'Install the offline FRC robotics scouting app for Team 9751',
          url: appUrl,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono tracking-tight">
                Distribute Scouting App
              </h2>
              <p className="text-[11px] text-slate-400">Share with scouts & drive team</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-3 pt-2 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'qr'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan QR Code</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('install')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'install'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install (PWA)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'sync'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Offline Sync</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: QR Code & Direct Link */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-white p-3 rounded-xl shadow-lg border-2 border-slate-700">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Scouting App QR Code"
                    className="w-52 h-52 object-contain"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                    Generating QR code...
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-200">
                  Point smartphone camera to open instantly
                </div>
                <div className="text-[11px] text-slate-400">
                  Scouts can scan this QR code directly off your screen or tablet
                </div>
              </div>

              {/* Shareable Link Input with Copy Button */}
              <div className="w-full flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5">
                <input
                  type="text"
                  readOnly
                  value={appUrl}
                  className="w-full bg-transparent px-2.5 text-[11px] text-slate-300 font-mono focus:outline-none select-all truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors shrink-0 active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors shadow-md cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Link via Apps (Messages / Discord / Slack)</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 2: PWA Installation */}
          {activeTab === 'install' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  <span>Progressive Web App (PWA) Offline Installation</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Installing the app adds an icon to your home screen and caches all assets locally, allowing scouts to use all scouting forms, field drawings, and databases with zero internet connection.
                </p>
              </div>

              {isInstalled ? (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-medium">App is already installed and running standalone!</span>
                </div>
              ) : isInstallable ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={install}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install App on this Device</span>
                  </button>
                  <p className="text-[11px] text-slate-500 text-center">
                    Chrome, Android, Edge, and desktop browsers support 1-click install.
                  </p>
                </div>
              ) : isIOS ? (
                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="font-bold text-slate-200">How to Install on iPhone / iPad (Safari):</div>
                  <div className="space-y-2 text-slate-300">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">1</span>
                      <span>Tap the <strong>Share</strong> button (square with arrow) at bottom of Safari.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">2</span>
                      <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">3</span>
                      <span>Tap <strong>Add</strong> in top right. Launches in fullscreen native mode!</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="font-bold text-slate-200">Browser Installation:</div>
                  <p className="text-[11px] text-slate-400">
                    Look for the install icon in your browser address bar or menu ("Install FRC REBUILT Scouting" or "Add to Home screen").
                  </p>
                </div>
              )}

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Works 100% offline inside competition arenas with poor connectivity.</span>
              </div>
            </div>
          )}

          {/* TAB 3: Team Scouting & Offline Sync */}
          {activeTab === 'sync' && (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200">How to sync data between scouts at competitions:</div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-200">1.</span>
                    <span>Scouts collect data offline in the stands or pit using their installed app.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-200">2.</span>
                    <span>Navigate to <strong>Import / Export</strong> to generate a rapid QR code or export a JSON backup file.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-200">3.</span>
                    <span>The lead scout or drive strategist scans the QR code or imports the file to merge all match observations into the master database.</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Go to Data Management</div>
                  <div className="text-[11px] text-slate-400">Export / Import scouting backups & QR codes</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono text-[11px]">FRC 9751 Scouting System</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
