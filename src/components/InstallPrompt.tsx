import { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';

const DISMISS_KEY = 'sparkpos-install-dismissed';
const DISMISS_DAYS = 7;

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) return;
    } catch {}

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      // Small delay so it doesn't fight the page load.
      setTimeout(() => setVisible(true), 2500);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS has no beforeinstallprompt — show manual steps instead.
    if (isIOS()) {
      const t = setTimeout(() => setVisible(true), 2500);
      return () => {
        window.removeEventListener('beforeinstallprompt', onPrompt);
        clearTimeout(t);
      };
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visible || isStandalone()) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    try {
      setInstalling(true);
      deferred.prompt();
      await deferred.userChoice;
    } finally {
      setInstalling(false);
      setDeferred(null);
      setVisible(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-16 md:bottom-4 z-[60] px-4 pb-safe flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-dark-900 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom">
        <div className="w-11 h-11 rounded-xl bg-brand-500 flex items-center justify-center shrink-0">
          <span className="text-white font-display font-bold text-2xl leading-none">S</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Install DinoScan app</p>
          {deferred || !isIOS() ? (
            <p className="text-xs text-white/70">Faster access, works offline, fullscreen billing.</p>
          ) : (
            <p className="text-xs text-white/70 flex items-center">
              Tap <Share className="w-3.5 h-3.5 mx-1" /> Share → “Add to Home Screen”.
            </p>
          )}
        </div>
        {(deferred || !isIOS()) && (
          <button
            onClick={install}
            disabled={installing || !deferred}
            className="shrink-0 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 font-bold text-sm transition-colors disabled:opacity-60 flex items-center"
          >
            <Download className="w-4 h-4 mr-1" />
            {installing ? '...' : 'Install'}
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1.5 text-white/60 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
