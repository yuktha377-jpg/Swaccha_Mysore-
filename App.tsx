import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User as FirebaseUser, signOut } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import CitizenDashboard from './pages/CitizenDashboard';
import MunicipalityDashboard from './pages/MunicipalityDashboard';
import { LogIn, Trash2, MapPin, User as UserIcon, LogOut, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';

export interface UserProfile {
  uid: string;
  role: 'citizen' | 'staff' | 'admin';
  name: string;
  email: string;
  area?: string;
  photoUrl?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (role: 'citizen' | 'staff', staffSecret?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        
        // Listen for real-time profile updates
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Initial setup if doc doesn't exist
            const newProfile: UserProfile = {
              uid: user.uid,
              role: 'citizen',
              name: user.displayName || 'User',
              email: user.email || '',
            };
            setDoc(docRef, newProfile);
          }
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = async (role: 'citizen' | 'staff', staffSecret?: string) => {
    // Removed staff ID verification as per user request to allow login without authorized ID
    
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Handle profile creation/update with the specific role chosen during login
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      const newProfile: UserProfile = {
        uid: user.uid,
        role: role,
        name: user.displayName || 'User',
        email: user.email || '',
      };
      await setDoc(docRef, newProfile);
    } else {
      // Always update the role to the one selected during login for better UX
      // and to fix the issue where users couldn't switch back to citizen.
      await setDoc(docRef, { role: role }, { merge: true });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'citizen' | 'staff'>('citizen');
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setIsVerifying(true);
    try {
      await login(selectedRole, selectedRole === 'staff' ? staffId : undefined);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const seedDefaultId = async () => {
    try {
      const defaultId = "MCC-2024-ADMIN";
      await setDoc(doc(db, 'staff_verification', defaultId), {
        key: defaultId,
        active: true
      });
      alert(`Default Staff ID "${defaultId}" has been seeded for testing.`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="absolute top-4 right-4 group">
        <button 
          onClick={seedDefaultId}
          className="p-2 text-slate-200 hover:text-slate-400 group-hover:opacity-100 opacity-0 transition-opacity flex items-center gap-2 text-[10px] font-mono"
        >
          <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
          Seed Test ID
        </button>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Mysore Swachha</h1>
          <p className="text-slate-500 text-sm">Connecting citizens with the Mysore Municipal Office for a cleaner city.</p>
        </div>

        <div className="bg-slate-100 p-1.5 rounded-2xl flex mb-6">
          <button 
            onClick={() => setSelectedRole('citizen')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
              selectedRole === 'citizen' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Citizen Portal
          </button>
          <button 
            onClick={() => setSelectedRole('staff')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
              selectedRole === 'staff' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Municipality Portal
          </button>
        </div>

        <AnimatePresence mode="wait">
          {selectedRole === 'staff' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-900">Staff Portal Access</p>
                  <p className="text-xs text-blue-700 mt-1">Authorized ID check is currently disabled for evaluation. You can sign in directly.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isVerifying}
          className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 px-6 rounded-2xl font-semibold hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
        >
          {isVerifying ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <LogIn className="w-5 h-5" />
          )}
          {selectedRole === 'staff' ? 'Enter Municipality Portal' : 'Enter Citizen Portal'}
        </button>
      </motion.div>
    </div>
  );
}

function Navbar() {
  const { profile, logout } = useAuth();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto glass rounded-2xl flex items-center justify-between px-6 py-3 shadow-lg">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-green-600 p-1.5 rounded-lg">
            <Trash2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 hidden sm:block">Mysore Swachha</span>
        </Link>
        
        <div className="flex items-center gap-4">
          {profile && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-900">{profile.name}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <ShieldCheck className={cn("w-3 h-3", profile.role === 'staff' || profile.role === 'admin' ? "text-green-500" : "text-blue-500")} />
                  {profile.role}
                </span>
              </div>
              <button 
                onClick={logout}
                className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                title="Log Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function App() {
  const { profile, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Trash2 className="w-8 h-8 text-green-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Wait for profile to load for authenticated users
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 font-medium">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12">
      <Navbar />
      <Routes>
        <Route 
          path="/citizen/*" 
          element={profile.role === 'citizen' ? <CitizenDashboard /> : <Navigate to="/municipality" />} 
        />
        <Route 
          path="/municipality/*" 
          element={profile.role === 'staff' || profile.role === 'admin' ? <MunicipalityDashboard /> : <Navigate to="/citizen" />} 
        />
        <Route 
          path="/" 
          element={<Navigate to={profile.role === 'staff' || profile.role === 'admin' ? '/municipality' : '/citizen'} />} 
        />
      </Routes>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  );
}
