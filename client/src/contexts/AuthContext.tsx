import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AuthSession,
  AuthUser,
  getMeApi,
  loginApi,
  loginWithGoogleApi,
  registerApi,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY
} from "../services/api";
import { saveAccountToStorage } from "../utils/savedAccounts";

export interface LoginResult {
  user?: AuthUser;
  requirePasskey?: boolean;
  email?: string;
  name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isUser: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string; passkey?: string }) => Promise<LoginResult>;
  loginWithGoogle: (googleData: {
    credential?: string;
    googleId?: string;
    email?: string;
    name?: string;
    profileImage?: string;
    role?: string;
    passkey?: string;
  }) => Promise<AuthUser>;
  loginAs: (role: "ADMIN" | "STAFF" | "USER") => Promise<AuthUser>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: "USER" | "TECHNICIAN" | "ADMIN";
    department?: string;
  }) => Promise<AuthUser>;
  logout: () => void;
  switchRole: (targetRole: "ADMIN" | "STAFF" | "USER") => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_ACCOUNTS = {
  ADMIN: {
    email: "admin@resolveai.com",
    password: "admin123",
    fallbackUser: {
      id: "admin-system-id",
      name: "System Administrator",
      email: "admin@resolveai.com",
      role: "ADMIN" as const,
      department: "IT Infrastructure",
      active: true
    }
  },
  STAFF: {
    email: "staff@resolveai.com",
    password: "staff123",
    fallbackUser: {
      id: "staff-sam-id",
      name: "Sam Staff",
      email: "staff@resolveai.com",
      role: "STAFF" as const,
      department: "IT Support",
      active: true
    }
  },
  USER: {
    email: "user@resolveai.com",
    password: "user123",
    fallbackUser: {
      id: "user-alex-id",
      name: "Alex User",
      email: "user@resolveai.com",
      role: "USER" as const,
      department: "Product Engineering",
      active: true
    }
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session with /auth/me on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      const isMockToken = savedToken.startsWith("mock-") || savedToken.startsWith("switched-") || savedToken.startsWith("google-session-");

      if (isMockToken) {
        const savedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            setUser(parsed);
            saveAccountToStorage(parsed);
          } catch {
            logout();
          }
        }
        setIsLoading(false);
        return;
      }

      // Optimistically populate state from localStorage for fast initial render
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
          saveAccountToStorage(parsed);
        } catch {
          // fall through to /auth/me
        }
      }

      try {
        const currentUser = await getMeApi();
        setUser(currentUser);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
        saveAccountToStorage(currentUser);
      } catch (err) {
        console.warn("Session check failed or offline:", err);
        if (!savedUser) {
          logout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const saveSession = (session: AuthSession, passkey?: string) => {
    setUser(session.user);
    setToken(session.token);
    localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
    saveAccountToStorage({ ...session.user, passkey });
  };

  const login = async (credentials: {
    email: string;
    password: string;
    passkey?: string;
  }): Promise<LoginResult> => {
    setIsLoading(true);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    try {
      const result = await loginApi(credentials);
      if ("requirePasskey" in result && result.requirePasskey) {
        return {
          requirePasskey: true,
          email: result.email,
          name: result.name
        };
      }
      const session = result as AuthSession;
      saveSession(session, credentials.passkey);
      return { user: session.user };
    } catch (error: any) {
      // Check if trying demo credentials and backend threw error, fallback smoothly
      const normalizedEmail = credentials.email.trim().toLowerCase();
      if (
        normalizedEmail === DEMO_ACCOUNTS.ADMIN.email &&
        credentials.password === DEMO_ACCOUNTS.ADMIN.password
      ) {
        if (!credentials.passkey) {
          return {
            requirePasskey: true,
            email: DEMO_ACCOUNTS.ADMIN.email,
            name: DEMO_ACCOUNTS.ADMIN.fallbackUser.name
          };
        }
        if (!/^\d{6}$/.test(credentials.passkey.trim())) {
          throw new Error("Invalid 6-digit security passkey. Access denied.");
        }
        const fallbackSession: AuthSession = {
          user: DEMO_ACCOUNTS.ADMIN.fallbackUser as any,
          token: "mock-admin-token-" + Date.now()
        };
        saveSession(fallbackSession, credentials.passkey);
        return { user: fallbackSession.user };
      }
      if (
        normalizedEmail === DEMO_ACCOUNTS.STAFF.email &&
        credentials.password === DEMO_ACCOUNTS.STAFF.password
      ) {
        const fallbackSession: AuthSession = {
          user: DEMO_ACCOUNTS.STAFF.fallbackUser as any,
          token: "mock-staff-token-" + Date.now()
        };
        saveSession(fallbackSession);
        return { user: fallbackSession.user };
      }
      if (
        normalizedEmail === DEMO_ACCOUNTS.USER.email &&
        credentials.password === DEMO_ACCOUNTS.USER.password
      ) {
        const fallbackSession: AuthSession = {
          user: DEMO_ACCOUNTS.USER.fallbackUser as any,
          token: "mock-user-token-" + Date.now()
        };
        saveSession(fallbackSession);
        return { user: fallbackSession.user };
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (googleData: {
    credential?: string;
    googleId?: string;
    email?: string;
    name?: string;
    profileImage?: string;
    role?: string;
    passkey?: string;
  }): Promise<AuthUser> => {
    setIsLoading(true);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    try {
      const session = await loginWithGoogleApi(googleData);
      saveSession(session, googleData.passkey);
      return session.user;
    } catch (error: any) {
      // In offline / dev fallback, only require 6-digit passkey for ADMIN
      const role = (googleData.role as any) || "USER";
      if (role === "ADMIN") {
        const pass = (googleData.passkey || "").trim();
        if (!pass || !/^\d{6}$/.test(pass)) {
          throw new Error("Please enter your 6-digit security passkey to access Administrator.");
        }
      }

      const email = googleData.email || "google.user@resolveai.com";
      const fallbackSession: AuthSession = {
        user: {
          id: googleData.googleId || "google-user-" + Date.now(),
          name: googleData.name || email.split("@")[0] || "Google User",
          email,
          role,
          googleId: googleData.googleId,
          profileImage: googleData.profileImage,
          active: true,
          status: "ACTIVE"
        },
        token: "google-session-jwt-" + Date.now()
      };
      saveSession(fallbackSession, googleData.passkey);
      return fallbackSession.user;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAs = async (role: "ADMIN" | "STAFF" | "USER"): Promise<AuthUser> => {
    const config = DEMO_ACCOUNTS[role];
    try {
      const res = await login({
        email: config.email,
        password: config.password,
        passkey: role === "ADMIN" ? "123456" : undefined
      });
      if (res.user) return res.user;
      throw new Error("Login failed");
    } catch {
      // Fallback in case backend is offline
      const fallbackSession: AuthSession = {
        user: config.fallbackUser as any,
        token: `mock-${role.toLowerCase()}-token-${Date.now()}`
      };
      saveSession(fallbackSession, role === "ADMIN" ? "123456" : undefined);
      return fallbackSession.user;
    }
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    role?: "USER" | "TECHNICIAN" | "ADMIN";
    department?: string;
  }): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const session = await registerApi(data);
      saveSession(session);
      return session.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  const switchRole = (targetRole: "ADMIN" | "STAFF" | "USER") => {
    const config = DEMO_ACCOUNTS[targetRole];
    const newSession: AuthSession = {
      user: config.fallbackUser as any,
      token: `switched-${targetRole.toLowerCase()}-token-${Date.now()}`
    };
    saveSession(newSession);
  };

  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF" || user?.role === "TECHNICIAN";
  const isUser = user?.role === "USER";
  const isAuthenticated = Boolean(user && token);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        isStaff,
        isUser,
        isLoading,
        login,
        loginWithGoogle,
        loginAs,
        register,
        logout,
        switchRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
