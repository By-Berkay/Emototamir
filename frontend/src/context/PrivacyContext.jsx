import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import PinDialog from "../components/PinDialog";
import { setRevealToken } from "../lib/api";

// Parasal değerleri gizler. Durum yalnızca bellekte tutulur: sayfa yenilenince yeniden gizlenir.
// 10 dakika hareketsizlikte kendiliğinden tekrar gizlenir.
const IDLE_MS = 10 * 60 * 1000;
const PrivacyContext = createContext(null);

export function PrivacyProvider({ children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const timer = useRef(null);

  const lock = useCallback(() => {
    setRevealToken(null);
    setUnlocked(false);
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const unlock = useCallback((token) => {
    setRevealToken(token);
    setUnlocked(true);
    setPinOpen(false);
  }, []);

  // Açıkken hareketsizlik süresini sıfırla; süre dolunca kilitle
  useEffect(() => {
    if (!unlocked) return undefined;
    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(lock, IDLE_MS);
    };
    bump();
    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump));
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [unlocked, lock]);

  const value = { unlocked, lock, unlock, pinOpen, openPin: () => setPinOpen(true), closePin: () => setPinOpen(false) };
  return (
    <PrivacyContext.Provider value={value}>
      {children}
      {pinOpen && <PinDialog onClose={() => setPinOpen(false)} onUnlock={unlock} />}
    </PrivacyContext.Provider>
  );
}

export const usePrivacy = () =>
  useContext(PrivacyContext) || { unlocked: false, lock() {}, unlock() {}, openPin() {}, closePin() {}, pinOpen: false };
