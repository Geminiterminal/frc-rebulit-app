import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, Upload, ClipboardCheck, AlertCircle } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  title?: string;
  onScanResult: (decodedText: string) => void;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  title = 'Scan QR Code',
  onScanResult,
  onClose,
}) => {
  const [manualInput, setManualInput] = useState('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = 'qr-reader-video-container';

  useEffect(() => {
    if (isOpen) {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }
    return () => {
      stopCameraScanner();
    };
  }, [isOpen]);

  const startCameraScanner = async () => {
    setScannerError(null);
    setIsScanning(true);

    // Wait for DOM container element
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          stopCameraScanner();
          onScanResult(decodedText);
        },
        () => {
          // Frame scan error (ignore standard empty frames)
        }
      );
    } catch (err: any) {
      setIsScanning(false);
      setScannerError('Camera access unavailable or blocked. Use manual paste/file input below.');
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      stopCameraScanner();
      onScanResult(manualInput.trim());
      setManualInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-4 shadow-2xl space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-sm">
            <Camera className="w-4 h-4" />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraScanner();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Container */}
        <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[250px] flex items-center justify-center">
          <div id={elementId} className="w-full h-full" />

          {scannerError && (
            <div className="p-4 text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300 font-sans">{scannerError}</p>
            </div>
          )}
        </div>

        {/* Manual Paste / Input Fallback */}
        <form onSubmit={handleManualSubmit} className="space-y-2 pt-1 border-t border-slate-800">
          <label className="text-[11px] font-bold text-slate-300 font-mono block">
            Manual Paste / QR Data Text:
          </label>
          <textarea
            rows={2}
            placeholder="Paste QR payload text string here..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Submit QR Data</span>
          </button>
        </form>
      </div>
    </div>
  );
};
