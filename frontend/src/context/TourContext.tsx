import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSegments } from "expo-router";
import PandyTour from "@/components/PandyTour";
import { useAuth } from "@/context/AuthContext";
import { tokenStorage } from "@/utils/tokenStorage";
import type { Role } from "@/types/auth";

const TOUR_ROLES: Role[] = ["homeowner", "contractor", "supplier", "worker"];

interface TourContextValue {
  /** Replay Pandy's tour for the role section the user is currently in. */
  openTour: () => void;
}

const TourContext = createContext<TourContextValue>({ openTour: () => {} });

export const useTour = () => useContext(TourContext);

// Shows Pandy's tour automatically the first time each user enters a role section,
// and lets any screen replay it via useTour().openTour().
export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const segments = useSegments();
  const section = (segments as string[])[1];
  const role = TOUR_ROLES.find((r) => r === section);
  const [visible, setVisible] = useState(false);

  const seenKey = user && role ? `pandy_tour_seen_${user.id}_${role}` : null;

  useEffect(() => {
    if (!seenKey) return;
    let cancelled = false;
    tokenStorage.getItem(seenKey).then((seen) => {
      if (!cancelled && !seen) setTimeout(() => !cancelled && setVisible(true), 600);
    });
    return () => {
      cancelled = true;
    };
  }, [seenKey]);

  const close = useCallback(() => {
    setVisible(false);
    if (seenKey) tokenStorage.setItem(seenKey, "1").catch(() => {});
  }, [seenKey]);

  const value = useMemo(() => ({ openTour: () => setVisible(true) }), []);

  return (
    <TourContext.Provider value={value}>
      {children}
      {role ? <PandyTour key={role} role={role} visible={visible} onClose={close} /> : null}
    </TourContext.Provider>
  );
}
