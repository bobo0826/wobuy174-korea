"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    const register = () => { void navigator.serviceWorker.register("/sw.js"); };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}

export function InstallAppButton({ className = "" }: { className?: string }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAppleGuide, setShowAppleGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setInstalled(true);
      setShowAppleGuide(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    if (isAppleMobile()) setShowAppleGuide(true);
  };

  // Android/desktop browsers emit beforeinstallprompt when the app meets their install criteria.
  // Safari does not, so the same button opens a short, native Safari instruction there.
  if (!installPrompt && !isAppleMobile()) return null;

  return <>
    <button type="button" onClick={() => { void install(); }} className={`inline-flex h-10 items-center justify-center rounded-xl border border-[#D9E4DE] bg-[#F3F8F3] px-3 text-xs font-semibold text-[#45634C] ${className}`}>
      ↓ 安裝 App
    </button>
    {showAppleGuide && <div className="fixed inset-0 z-[80] flex items-end bg-[#292824]/35 p-4 sm:items-center sm:justify-center">
      <section role="dialog" aria-modal="true" aria-label="安裝到主畫面" className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">INSTALL APP</p><h2 className="mt-2 text-lg font-semibold">加入手機主畫面</h2></div>
          <button type="button" aria-label="關閉安裝說明" onClick={() => setShowAppleGuide(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg">×</button>
        </div>
        <ol className="mt-5 space-y-3 rounded-2xl bg-[#F8F6F2] p-4 text-sm leading-6 text-[#625C53]">
          <li>1. 在 Safari 下方按 <b>分享</b>。</li>
          <li>2. 選擇 <b>加入主畫面</b>。</li>
          <li>3. 確認名稱後按 <b>新增</b>。</li>
        </ol>
        <p className="mt-4 text-xs leading-5 text-[#8D877E]">加入後可從主畫面直接開啟；需連網才能同步訂單與庫存資料。</p>
      </section>
    </div>}
  </>;
}
