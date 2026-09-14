import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';

export function BarcodeScannerModal({ 
  isOpen, 
  onClose, 
  onScan 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onScan: (code: string) => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isOpen) {
      scannerRef.current = new Html5Qrcode("reader");
      
      scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 100 } // Wider for barcodes
        },
        (decodedText) => {
          // Play beep sound
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
          } catch(e) {}
          
          onScan(decodedText);
          onClose();
        },
        (error) => {
          // Ignore frequent scanning errors
        }
      ).catch(err => {
        console.error("Scanner failed to start", err);
      });
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <h2 className="font-bold text-lg text-gray-900">Scan Barcode</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 bg-gray-50 flex-1 flex flex-col items-center justify-center min-h-[300px]">
          <div id="reader" className="w-full h-full rounded-lg overflow-hidden border border-gray-200 bg-black"></div>
        </div>
      </div>
    </div>
  );
}
