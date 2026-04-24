import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    username?: string;
  };
  message: string;
}

interface User {
  id: string;
  email: string;
  username?: string;
  tier?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, username?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const didFetchRef = useRef(false); // Guard against StrictMode double-fetch

  useEffect(() => {
    // Prevent duplicate fetch in StrictMode
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    // Check for stored token on mount
    const token = sessionStorage.getItem('access_token');
    
    if (token) {
      apiClient.setToken(token);
      
      // Verify token and get user
      apiClient.getCurrentUser()
        .then((userData: User) => {
          setUser(userData);
        })
        .catch((error) => {
          // Token invalid, clear everything
          console.log('Token validation failed:', error.message);
          sessionStorage.removeItem('access_token');
          sessionStorage.removeItem('refresh_token');
          apiClient.setToken(null);
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const signUp = async (email: string, password: string, username?: string) => {
    try {
      const response = await apiClient.signup(email, password, username) as AuthResponse;
      
      // Store tokens in sessionStorage (cleared on browser close for XSS protection)
      sessionStorage.setItem('access_token', response.access_token);
      sessionStorage.setItem('refresh_token', response.refresh_token);
      
      // Set API client token
      apiClient.setToken(response.access_token);
      
      // Set user
      setUser(response.user);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password) as AuthResponse;
      
      // Store tokens in sessionStorage (cleared on browser close for XSS protection)
      sessionStorage.setItem('access_token', response.access_token);
      sessionStorage.setItem('refresh_token', response.refresh_token);
      
      // Set API client token
      apiClient.setToken(response.access_token);
      
      // Set user
      setUser(response.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear tokens and user
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      apiClient.setToken(null);
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
