import { createContext, useContext } from 'react';

export type Route = 'start' | 'kalender' | 'noten' | 'training' | 'gesundheit' | 'einstellungen' | 'bericht' | 'workout';

export interface Nav {
  route: Route;
  go: (r: Route, sub?: string) => void;
  /** Optional sub section, e.g. the health tab. */
  sub?: string;
}

export const NavContext = createContext<Nav>({ route: 'start', go: () => {} });

export function useNav(): Nav {
  return useContext(NavContext);
}
