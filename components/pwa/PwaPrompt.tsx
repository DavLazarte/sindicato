'use client';

import { useState, useEffect } from 'react';

// Interfaz para el evento beforeinstallprompt (no es estándar en TS aún)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
  prompt(): Promise<void>;
}

export function PwaPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada
    const standalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone === true);
    setIsStandalone(standalone);

    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Manejar el evento para Chrome/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Si es iOS y no está instalada, mostramos el prompt
    if (ios && !standalone) {
      // Verificar si ya se descartó el prompt en esta sesión para no molestar siempre
      if (!sessionStorage.getItem('pwa_prompt_dismissed')) {
        setShowPrompt(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    
    // Mostrar el prompt nativo
    await installPrompt.prompt();
    
    // Esperar a ver qué eligió el usuario
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    
    // Limpiar el prompt ya usado
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:hidden animate-in slide-in-from-bottom-5">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white rounded-xl p-1 flex items-center justify-center shrink-0">
            <img src="/logo-soem.png" alt="SOEM Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">Instalar SOEM Beneficios</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {isIOS 
                ? 'Para instalar la app, tocá Compartir en tu navegador y elegí "Agregar a inicio".'
                : 'Instalá nuestra app para acceso rápido y directo desde tu pantalla de inicio.'}
            </p>
          </div>
          <button onClick={handleDismiss} className="text-slate-400 hover:text-white p-1">
            ✕
          </button>
        </div>
        
        {!isIOS && installPrompt && (
          <button 
            onClick={handleInstallClick}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
          >
            Instalar App
          </button>
        )}
        {isIOS && (
          <div className="flex justify-center gap-2 text-slate-300 mt-1">
            <span className="text-xl text-blue-400">⎋</span>
            <span className="text-xl">+</span>
          </div>
        )}
      </div>
    </div>
  );
}
