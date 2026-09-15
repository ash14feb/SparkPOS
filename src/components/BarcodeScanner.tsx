import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Loader2 } from 'lucide-react';

export function playScanBeep() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const audioCtx = new AC();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.12);
    setTimeout(() => { try { (audioCtx.close as unknown as () => void)(); } catch {} }, 300);
  } catch {}
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    setError(null);
    setStarting(true);

    // Guard: library needs a secure context + camera.
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setError('Camera needs HTTPS. Open the app over a secure connection.');
      setStarting(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('No camera found on this device.');
      setStarting(false);
      return;
    }

    (async () => {
      try {
        scanner = new Html5Qrcode('barcode-reader', { verbose: false } as any);
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 120 } },
          (decodedText) => {
            if (cancelled) return;
            playScanBeep();
            onScanRef.current(decodedText);
            onCloseRef.current();
          },
          () => { /* per-frame misses are normal — ignore */ }
        );
        if (!cancelled) setStarting(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Scanner failed to start', err);
        const name = err?.name || '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access and retry.'
            : name === 'NotFoundError'
            ? 'No camera found on this device.'
            : name === 'NotReadableError'
            ? 'Camera is busy (another app/tab is using it).'
            : 'Could not start the camera. Check permission and retry.'
        );
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        const s = scanner;
        scanner = null;
        // clear() stops the stream AND removes the video element (StrictMode-safe).
        try { Promise.resolve(s.clear()).catch(() => {}); } catch {}
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <h2 className="font-bold text-lg text-gray-900 flex items-center">
            <Camera className="w-5 h-5 mr-2 text-brand-600" /> Scan Barcode
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 bg-gray-50 flex-1 flex flex-col items-center justify-center min-h-[300px]">
          <div id="barcode-reader" className="w-full rounded-lg overflow-hidden border border-gray-200 bg-black" />
          {starting && !error && (
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Starting camera…
            </div>
          )}
          {error && (
            <div className="mt-3 w-full p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg text-center">
              {error}
            </div>
          )}
          {!error && (
            <p className="mt-3 text-xs text-gray-500 text-center">Point the camera at the barcode — it beeps on capture.</p>
          )}
        </div>
      </div>
    </div>
  );
}
