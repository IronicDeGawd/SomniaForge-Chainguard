import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();

  // Check token on mount and address change
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      const storedToken = localStorage.getItem('auth_token');
      const storedAddress = localStorage.getItem('auth_address');

      if (storedToken && storedAddress && address && storedAddress === address.toLowerCase()) {
        // Verify token is still valid by making a test request
        const valid = await verifyToken(storedToken);
        if (valid) {
          setToken(storedToken);
          setIsAuthenticated(true);
        } else {
          logout();
          toast({
            title: 'Session Expired',
            description: 'Please sign in again.',
            variant: 'destructive'
          });
        }
      } else {
        // Clear auth state if address changed or no token
        setIsAuthenticated(false);
        setToken(null);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [address, isConnected]);

  // Listen for logout events from API layer
  useEffect(() => {
    const handleLogout = () => {
      logout();
      toast({
        title: 'Session Expired',
        description: 'Please sign in again.',
        variant: 'destructive'
      });
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      // Make a test request to verify token
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/contracts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return true;
    } catch {
      return false;
    }
  };

  const login = async () => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      const timestamp = Date.now().toString();
      const message = `Login to ChainGuard: ${timestamp}`;

      const signature = await signMessageAsync({
        message,
        account: address
      });

      // Exchange signature for JWT
      const response = await api.post('/api/auth/login', {
        address,
        signature,
        timestamp
      });

      const { token: newToken } = response;

      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('auth_address', address.toLowerCase());

      // Clear legacy signature auth
      localStorage.removeItem('auth_signature');
      localStorage.removeItem('auth_timestamp');

      setToken(newToken);
      setIsAuthenticated(true);

      toast({
        title: 'Logged In',
        description: 'Welcome to ChainGuard!'
      });
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Failed to authenticate',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_address');
    setToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
