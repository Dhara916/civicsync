import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile } from '../services/authService';
import { errorMessage } from '../lib/errors';
import type { Profile, SessionUser } from '../contracts/database';
interface AuthState { user: SessionUser | null; profile: Profile | null; loading: boolean; error: string | null; refresh: () => void }
const AuthContext = createContext<AuthState>({user: null, profile: null, loading: true, error: null, refresh: () => {}});
export function AuthProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState<Omit<AuthState, 'refresh'>>({user: null, profile: null, loading: !!supabase, error: null});
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++sequence.current;
    if (!supabase) { setState({user: null, profile: null, loading: false, error: null}); return; }
    try {
      const {data, error} = await supabase.auth.getSession();
      if (error) throw error;
      const user = data.session?.user;
      if (ticket !== sequence.current) return;
      if (!user) { setState({user: null, profile: null, loading: false, error: null}); return; }
      const safeUser = {id: user.id, email: user.email ?? null};
      setState(previous => previous.user?.id === safeUser.id ? {...previous, user: safeUser, error: null} : {user: safeUser, profile: null, loading: true, error: null});
      try {
        const profile = await getProfile(user.id);
        if (ticket === sequence.current) setState({user: safeUser, profile, loading: false, error: profile ? null : 'Your sign-in is valid, but the backend has not created your profile. Person 2 must configure profile provisioning.'});
      } catch (e) { if (ticket === sequence.current) setState({user: safeUser, profile: null, loading: false, error: errorMessage(e)}); }
    } catch (e) { if (ticket === sequence.current) setState({user: null, profile: null, loading: false, error: errorMessage(e)}); }
  }, []);
  useEffect(() => {
    void load();
    // Do not await Supabase calls inside onAuthStateChange: defer outside its callback.
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event !== 'TOKEN_REFRESHED') window.setTimeout(() => void load(), 0);
    }).data.subscription;
    const focus = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', focus);
    return () => { ++sequence.current; subscription?.unsubscribe(); document.removeEventListener('visibilitychange', focus); };
  }, [load]);
  return <AuthContext.Provider value={{...state, refresh: () => void load()}}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
