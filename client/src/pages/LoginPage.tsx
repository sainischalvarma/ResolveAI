import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wrench,
  User as UserIcon,
  Shield,
  Mail,
  Lock,
  Key,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  X
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";
import robotMascot from "../assets/robot-mascot.jpg";
import {
  getSavedAccounts,
  removeSavedAccountFromStorage,
  SavedAccount
} from "../utils/savedAccounts";

type RoleType = "staff" | "user" | "admin";

const demoCredentials: Record<RoleType, { email: string; pass: string }> = {
  staff: { email: "staff@resolveai.com", pass: "staff123" },
  user: { email: "user@resolveai.com", pass: "user123" },
  admin: { email: "admin@resolveai.com", pass: "admin123" }
};

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, register, isLoading } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regDepartment, setRegDepartment] = useState("");
  const [regRole, setRegRole] = useState<"USER" | "TECHNICIAN" | "ADMIN">("USER");
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<RoleType>("staff");
  const [email, setEmail] = useState(demoCredentials.staff.email);
  const [password, setPassword] = useState(demoCredentials.staff.pass);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Google Modal State & Step Management
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleModalStep, setGoogleModalStep] = useState<"accounts" | "add_account" | "passkey">("accounts");
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());
  const [targetAccount, setTargetAccount] = useState<{
    email: string;
    name: string;
    role: string;
    profileImage?: string;
  } | null>(null);

  // 6-digit numeric passkey state
  const [passkeyDigits, setPasskeyDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [showPasskey, setShowPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Dedicated Admin 2-step passkey verification state (asked AFTER logging in with mail)
  const [showAdminPasskeyModal, setShowAdminPasskeyModal] = useState(false);
  const [pendingAdminAuth, setPendingAdminAuth] = useState<{
    type: "credentials" | "google";
    email: string;
    password?: string;
    googleData?: any;
  } | null>(null);
  const [adminPasskeyDigits, setAdminPasskeyDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [showAdminPasskey, setShowAdminPasskey] = useState(false);
  const [adminPasskeyError, setAdminPasskeyError] = useState<string | null>(null);
  const [adminPasskeyLoading, setAdminPasskeyLoading] = useState(false);
  const adminPinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Add / custom corporate account state
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountRole, setNewAccountRole] = useState<"USER" | "STAFF" | "ADMIN">("USER");
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(false);

  // Initialize Google Identity Services (GSI)
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const setupGsi = () => {
      const g = (window as any).google?.accounts?.id;
      if (!g) return false;

      try {
        g.initialize({
          client_id: clientId,
          callback: async (response: { credential?: string }) => {
            if (response.credential) {
              setGoogleSigningIn(true);
              setErrorMessage(null);
              try {
                const roleToUse = activeTab === "admin" ? "ADMIN" : activeTab === "staff" ? "STAFF" : "USER";
                if (roleToUse === "ADMIN") {
                  // After logging in with the mail, ask for the passkey for admin
                  setPendingAdminAuth({
                    type: "google",
                    email: "admin@resolveai.com",
                    googleData: {
                      credential: response.credential,
                      role: "ADMIN"
                    }
                  });
                  setAdminPasskeyDigits(["", "", "", "", "", ""]);
                  setAdminPasskeyError(null);
                  setShowAdminPasskeyModal(true);
                  setTimeout(() => adminPinInputRefs.current[0]?.focus(), 150);
                  return;
                }
                const loggedUser = await loginWithGoogle({
                  credential: response.credential,
                  role: roleToUse
                });
                redirectAfterLogin(loggedUser.role);
              } catch (err: any) {
                setErrorMessage(
                  err.response?.data?.message ||
                  err.message ||
                  "Google Sign-In failed. Please try again."
                );
              } finally {
                setGoogleSigningIn(false);
              }
            }
          }
        });

        if (googleBtnContainerRef.current) {
          g.renderButton(googleBtnContainerRef.current, {
            theme: "outline",
            size: "large",
            width: 380,
            text: "continue_with",
            shape: "rectangular"
          });
          setGsiLoaded(true);
        }
        return true;
      } catch (e) {
        console.warn("GSI render warning:", e);
        return false;
      }
    };

    if (!setupGsi()) {
      const timer = setInterval(() => {
        if (setupGsi()) {
          clearInterval(timer);
        }
      }, 400);
      return () => clearInterval(timer);
    }
  }, []);

  const openGoogleModal = () => {
    const list = getSavedAccounts();
    setSavedAccounts(list);
    setGoogleModalStep(list.length > 0 ? "accounts" : "add_account");
    setPasskeyDigits(["", "", "", "", "", ""]);
    setPasskeyError(null);
    setTargetAccount(null);
    setShowGoogleModal(true);
  };

  const handleSelectAccount = async (acc: {
    email: string;
    name: string;
    role: string;
    profileImage?: string;
    passkey?: string;
  }) => {
    const roleUpper = (acc.role || "USER").toUpperCase();
    if (roleUpper === "ADMIN") {
      setTargetAccount({
        email: acc.email,
        name: acc.name,
        role: "ADMIN",
        profileImage: acc.profileImage
      });
      if (acc.passkey && acc.passkey.length === 6) {
        setPasskeyDigits(acc.passkey.split(""));
      } else {
        setPasskeyDigits(["", "", "", "", "", ""]);
      }
      setPasskeyError(null);
      setGoogleModalStep("passkey");
      setTimeout(() => pinInputRefs.current[acc.passkey?.length === 6 ? 5 : 0]?.focus(), 100);
    } else {
      // USER, STAFF, and TECHNICIAN sign in directly with NO passkey required
      await handleGoogleSignIn(acc.email, acc.name, roleUpper);
    }
  };

  const handleRemoveAccount = (e: React.MouseEvent, targetEmail: string) => {
    e.stopPropagation();
    const updated = removeSavedAccountFromStorage(targetEmail);
    setSavedAccounts(updated);
    if (updated.length === 0) {
      setGoogleModalStep("add_account");
    }
  };

  const handlePinChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const updated = [...passkeyDigits];
      updated[index] = "";
      setPasskeyDigits(updated);
      return;
    }

    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split("");
      const updated = [...passkeyDigits];
      chars.forEach((c, idx) => {
        if (idx < 6) updated[idx] = c;
      });
      setPasskeyDigits(updated);
      const nextIdx = Math.min(chars.length, 5);
      pinInputRefs.current[nextIdx]?.focus();
      return;
    }

    const updated = [...passkeyDigits];
    updated[index] = clean[0];
    setPasskeyDigits(updated);
    setPasskeyError(null);

    if (index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!passkeyDigits[index] && index > 0) {
        const updated = [...passkeyDigits];
        updated[index - 1] = "";
        setPasskeyDigits(updated);
        pinInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const updated = [...passkeyDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || "";
    }
    setPasskeyDigits(updated);
    setPasskeyError(null);
    pinInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyPasskey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetAccount) return;
    const pin = passkeyDigits.join("").trim();
    if (pin.length !== 6) {
      setPasskeyError("Please enter all 6 digits of your security passkey.");
      return;
    }

    setPasskeyError(null);
    setPasskeyLoading(true);

    try {
      await handleGoogleSignIn(
        targetAccount.email,
        targetAccount.name,
        targetAccount.role,
        pin
      );
    } catch (err: any) {
      setPasskeyError(
        err.response?.data?.message ||
        err.message ||
        "Invalid 6-digit passkey. Access denied."
      );
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleAdminPinChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const updated = [...adminPasskeyDigits];
      updated[index] = "";
      setAdminPasskeyDigits(updated);
      return;
    }

    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split("");
      const updated = [...adminPasskeyDigits];
      chars.forEach((c, idx) => {
        if (idx < 6) updated[idx] = c;
      });
      setAdminPasskeyDigits(updated);
      const nextIdx = Math.min(chars.length, 5);
      adminPinInputRefs.current[nextIdx]?.focus();
      return;
    }

    const updated = [...adminPasskeyDigits];
    updated[index] = clean[0];
    setAdminPasskeyDigits(updated);
    setAdminPasskeyError(null);

    if (index < 5) {
      adminPinInputRefs.current[index + 1]?.focus();
    }
  };

  const handleAdminPinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!adminPasskeyDigits[index] && index > 0) {
        const updated = [...adminPasskeyDigits];
        updated[index - 1] = "";
        setAdminPasskeyDigits(updated);
        adminPinInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      adminPinInputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      adminPinInputRefs.current[index + 1]?.focus();
    }
  };

  const handleAdminPinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const updated = [...adminPasskeyDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || "";
    }
    setAdminPasskeyDigits(updated);
    setAdminPasskeyError(null);
    adminPinInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyAdminPasskey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pin = adminPasskeyDigits.join("").trim();
    if (pin.length !== 6) {
      setAdminPasskeyError("Please enter all 6 digits of your security passkey.");
      return;
    }

    setAdminPasskeyError(null);
    setAdminPasskeyLoading(true);

    try {
      if (pendingAdminAuth?.type === "credentials" && pendingAdminAuth.password) {
        const result = await login({
          email: pendingAdminAuth.email,
          password: pendingAdminAuth.password,
          passkey: pin
        });
        if (result.user) {
          setShowAdminPasskeyModal(false);
          setPendingAdminAuth(null);
          redirectAfterLogin(result.user.role);
        }
      } else if (pendingAdminAuth?.type === "google") {
        const loggedUser = await loginWithGoogle({
          ...pendingAdminAuth.googleData,
          passkey: pin
        });
        setShowAdminPasskeyModal(false);
        setPendingAdminAuth(null);
        redirectAfterLogin(loggedUser.role);
      }
    } catch (err: any) {
      setAdminPasskeyError(
        err.response?.data?.message ||
        err.message ||
        "Invalid 6-digit passkey. Access denied."
      );
    } finally {
      setAdminPasskeyLoading(false);
    }
  };

  const handleProceedWithNewAccount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = newAccountEmail.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setPasskeyError("Please enter a valid corporate email address.");
      return;
    }
    const cleanName = newAccountName.trim() || cleanEmail.split("@")[0];
    const role = newAccountRole;

    if (role === "ADMIN") {
      setTargetAccount({
        email: cleanEmail,
        name: cleanName,
        role: "ADMIN"
      });
      setPasskeyDigits(["", "", "", "", "", ""]);
      setPasskeyError(null);
      setGoogleModalStep("passkey");
      setTimeout(() => pinInputRefs.current[0]?.focus(), 100);
    } else {
      // USER or STAFF: No passkey, sign in directly!
      await handleGoogleSignIn(cleanEmail, cleanName, role);
    }
  };

  const handleGoogleSignIn = async (
    selectedEmail?: string,
    selectedName?: string,
    selectedRole?: string,
    selectedPasskey?: string
  ) => {
    setErrorMessage(null);
    setGoogleSigningIn(true);
    try {
      const emailToUse = selectedEmail || newAccountEmail.trim() || (activeTab === "staff" ? "staff@resolveai.com" : activeTab === "admin" ? "admin@resolveai.com" : "user@resolveai.com");
      const nameToUse = selectedName || newAccountName.trim() || emailToUse.split("@")[0];
      const roleToUse = selectedRole || (activeTab === "admin" ? "ADMIN" : activeTab === "staff" ? "STAFF" : "USER");
      const googleId = "google-oauth-" + Math.abs(emailToUse.split("").reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0));
      const profileImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameToUse)}&background=0284c7&color=fff`;

      const loggedUser = await loginWithGoogle({
        googleId,
        email: emailToUse,
        name: nameToUse,
        profileImage,
        role: roleToUse,
        passkey: roleToUse === "ADMIN" ? selectedPasskey : undefined
      });
      setShowGoogleModal(false);
      redirectAfterLogin(loggedUser.role);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Google authentication failed. Please try again.";
      setErrorMessage(msg);
      throw err;
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRegSubmitting(true);
    try {
      const loggedUser = await register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: regRole,
        department: regDepartment.trim() || undefined
      });
      redirectAfterLogin(loggedUser.role);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Registration failed. Please try again."
      );
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleTabSwitch = (newRole: RoleType) => {
    setActiveTab(newRole);
    setEmail(demoCredentials[newRole].email);
    setPassword(demoCredentials[newRole].pass);
    setErrorMessage(null);
  };

  const redirectAfterLogin = (userRole: string) => {
    const roleUpper = (userRole || "").toUpperCase();
    if (roleUpper === "ADMIN") {
      navigate("/admin/dashboard", { replace: true });
    } else if (roleUpper === "STAFF" || roleUpper === "TECHNICIAN") {
      navigate("/staff/dashboard", { replace: true });
    } else {
      navigate("/user/dashboard", { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const result = await login({ email, password });
      if (result.requirePasskey) {
        // Mail and password verified! Admin must now enter their 6-digit passkey.
        setPendingAdminAuth({
          type: "credentials",
          email,
          password
        });
        setAdminPasskeyDigits(["", "", "", "", "", ""]);
        setAdminPasskeyError(null);
        setShowAdminPasskeyModal(true);
        setTimeout(() => adminPinInputRefs.current[0]?.focus(), 150);
        return;
      }
      if (result.user) {
        redirectAfterLogin(result.user.role);
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Invalid login credentials. Please check your email and password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const roleDetails = {
    staff: {
      title: "Staff / Technician Login",
      description: "Access AI-assisted diagnostics, RAG procedures, and ticket resolution.",
      btnText: "Sign in as Staff Technician",
      icon: <Wrench className="w-4 h-4 text-blue-600" />
    },
    user: {
      title: "Employee / User Portal Login",
      description: "Access self-service AI troubleshooting, incident logging, and ticket status.",
      btnText: "Sign in as Employee User",
      icon: <UserIcon className="w-4 h-4 text-blue-600" />
    },
    admin: {
      title: "System Administrator Login",
      description: "Access technician triage, telemetry, incident supervision, and knowledge base.",
      btnText: "Sign in as Administrator",
      icon: <Shield className="w-4 h-4 text-blue-600" />
    }
  }[activeTab];

  return (
    <div className="min-h-screen w-full bg-[#f6f9fe] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 relative overflow-hidden flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans transition-colors duration-200">
      {/* Background Soft Dot Grid & Radial Glow Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Soft background blue ambient glow */}
        <div className="absolute -top-32 -left-20 w-[600px] h-[600px] bg-blue-100/70 dark:bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-sky-100/50 dark:bg-sky-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[550px] h-[550px] bg-blue-50/90 dark:bg-indigo-600/10 rounded-full blur-[130px]" />

        {/* Dot Matrix Grid Accents */}
        <svg
          className="absolute top-24 right-1/4 w-40 h-40 opacity-30 dark:opacity-10 text-blue-400"
          fill="currentColor"
          viewBox="0 0 100 100"
        >
          {[0, 20, 40, 60, 80].map((x) =>
            [0, 20, 40, 60, 80].map((y) => (
              <circle key={`${x}-${y}`} cx={x + 10} cy={y + 10} r="2.5" />
            ))
          )}
        </svg>

        <svg
          className="absolute bottom-28 right-6 w-32 h-48 opacity-25 dark:opacity-10 text-blue-400"
          fill="currentColor"
          viewBox="0 0 80 120"
        >
          {[0, 20, 40, 60].map((x) =>
            [0, 20, 40, 60, 80, 100].map((y) => (
              <circle key={`r-${x}-${y}`} cx={x + 10} cy={y + 10} r="2.5" />
            ))
          )}
        </svg>

        <svg
          className="absolute bottom-12 left-1/2 w-48 h-24 opacity-25 dark:opacity-10 text-blue-400"
          fill="currentColor"
          viewBox="0 0 120 60"
        >
          {[0, 20, 40, 60, 80, 100].map((x) =>
            [0, 20, 40].map((y) => (
              <circle key={`b-${x}-${y}`} cx={x + 10} cy={y + 10} r="2.5" />
            ))
          )}
        </svg>

        {/* Decorative Tropical Leaves at bottom corners matching reference */}
        {/* Bottom Left Foliage */}
        <svg
          className="absolute -bottom-10 -left-12 w-64 h-64 text-emerald-700/80 dark:opacity-30 drop-shadow-xl transform -rotate-12 pointer-events-none"
          viewBox="0 0 200 200"
          fill="none"
        >
          <path
            d="M-20,200 C30,120 90,90 170,80 C110,130 80,180 50,220 Z"
            fill="url(#leafGrad1)"
          />
          <path
            d="M-40,160 C20,90 80,50 150,20 C110,80 80,130 20,180 Z"
            fill="url(#leafGrad2)"
          />
          <path
            d="M-10,220 C60,160 120,130 190,120 C140,170 100,210 60,230 Z"
            fill="url(#leafGrad1)"
            opacity="0.85"
          />
          <defs>
            <linearGradient id="leafGrad1" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="60%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
            <linearGradient id="leafGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#065f46" />
              <stop offset="70%" stopColor="#059669" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
        </svg>

        {/* Bottom Right Foliage */}
        <svg
          className="absolute -bottom-12 -right-12 w-64 h-64 text-emerald-700/80 dark:opacity-30 drop-shadow-xl transform rotate-12 pointer-events-none"
          viewBox="0 0 200 200"
          fill="none"
        >
          <path
            d="M220,200 C170,120 110,90 30,80 C90,130 120,180 150,220 Z"
            fill="url(#leafGrad1)"
          />
          <path
            d="M240,160 C180,90 120,50 50,20 C90,80 120,130 180,180 Z"
            fill="url(#leafGrad2)"
          />
        </svg>
      </div>

      {/* Top Navbar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 pt-6 sm:pt-8 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-blue-500/25">
            RA
          </div>
          <div>
            <div className="flex items-center gap-0.5 text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
              Resolve<span className="text-blue-600 dark:text-blue-400">AI</span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              AI-Powered IT Incident Resolution
            </p>
          </div>
        </div>

        {/* Platform Status Indicator & Theme Toggle */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            Platform Online
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Product Value Narrative & 3D Robot Mascot */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Intelligent IT Support
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
            Resolve IT issues.
            <br />
            Faster. <span className="text-blue-600 dark:text-blue-400">with AI.</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-3.5 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
            AI-powered diagnosis, RAG knowledge, and automated ticket resolution — all in one workspace.
          </p>

          {/* 3D Mascot Illustration on Holographic Base */}
          <div className="relative mt-6 flex justify-center sm:justify-start">
            <div className="relative w-full max-w-[480px]">
              <img
                src={robotMascot}
                alt="ResolveAI Intelligent Robot Assistant"
                className="w-full h-auto object-contain rounded-2xl mix-blend-multiply dark:mix-blend-normal drop-shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Transparent Sign-in Form */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-[460px] bg-transparent relative">
            {/* Header */}
            <div className="flex items-end justify-between mb-1">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {mode === "login" ? "Welcome back" : "Create account"}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {mode === "login" ? "Sign in to your ResolveAI workspace" : "Register a new ResolveAI account"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setErrorMessage(null); }}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap mb-1 transition-colors"
              >
                {mode === "login" ? "Create account" : "Sign in instead"}
              </button>
            </div>

            {/* REGISTER FORM */}
            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4 mt-5">
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs">{errorMessage}</div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text" required value={regName} onChange={e => setRegName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-slate-50/60 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-slate-50/60 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showRegPassword ? "text" : "password"} required minLength={8}
                      value={regPassword} onChange={e => setRegPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full bg-slate-50/60 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-10 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 transition-all"
                    />
                    <button type="button" onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Department <span className="font-normal text-slate-400">(optional)</span></label>
                  <input
                    type="text" value={regDepartment} onChange={e => setRegDepartment(e.target.value)}
                    placeholder="e.g. Product Engineering"
                    className="w-full bg-slate-50/60 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Account Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["USER", "TECHNICIAN", "ADMIN"] as const).map(r => (
                      <button key={r} type="button" onClick={() => setRegRole(r)}
                        className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                          regRole === r
                            ? r === "ADMIN" ? "bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-800 dark:text-amber-300"
                              : r === "TECHNICIAN" ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-800 dark:text-blue-300"
                              : "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-300"
                            : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {r === "USER" ? "Employee" : r === "TECHNICIAN" ? "IT Staff" : "Admin"}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit" disabled={regSubmitting || isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
                >
                  {regSubmitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Creating account...</span></>
                  ) : (
                    <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}

            {/* LOGIN FORM — hidden when registering */}
            {mode === "login" && <>

            {/* 3 Role Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => handleTabSwitch("staff")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === "staff"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Staff / Tech</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch("user")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === "user"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>User</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch("admin")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === "admin"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            </div>

            {/* Active Role Title & Description */}
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {roleDetails.icon}
                <span>{roleDetails.title}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{roleDetails.description}</p>
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Google Authentication Button */}
            <div className="mb-4">
              {/* Google Identity Services Official One-Click Container */}
              <div
                ref={googleBtnContainerRef}
                className={`w-full flex justify-center ${gsiLoaded ? "min-h-[44px]" : "hidden"}`}
              />

              {/* Show fallback button ONLY if Google Identity Services hasn't rendered */}
              {!gsiLoaded && (
                <button
                  type="button"
                  onClick={openGoogleModal}
                  disabled={submitting || googleSigningIn || isLoading}
                  className="w-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 active:bg-slate-100 text-slate-800 dark:text-slate-100 font-semibold py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm hover:shadow flex items-center justify-center gap-3 text-sm transition-all duration-200 disabled:opacity-50 group"
                >
                  {googleSigningIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-slate-600 dark:text-slate-300">Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              )}

              {/* Optional saved accounts link if user has saved accounts */}
              {savedAccounts.length > 0 && gsiLoaded && (
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={openGoogleModal}
                    className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    Switch account or use saved profiles ({savedAccounts.length})
                  </button>
                </div>
              )}

              <div className="relative flex py-3 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                  Or sign in with password
                </span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={demoCredentials[activeTab].email}
                    className="w-full bg-slate-50/60 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50/60 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-10 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/30 cursor-pointer dark:bg-slate-800"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Primary Sign in Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={submitting || isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-sm sm:text-base transition-all duration-200 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>{roleDetails.btnText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            </> /* end login mode */}

            {/* Card Footer Trust Badges */}
            <div className="flex items-center justify-center gap-6 mt-6 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Secure
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Reliable
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                AI-Powered
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle bottom spacing */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
        ResolveAI &copy; {new Date().getFullYear()} &bull; Adaptive Enterprise Incident Resolution
      </footer>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-slate-900 dark:text-white">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Workspace Sign-in Help</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              ResolveAI operates unified single sign-on (SSO). For this interactive preview, you can
              sign in directly using the <strong>Quick Access</strong> demo logins:
            </p>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 mb-5">
              <p>
                • Staff: <span className="font-semibold text-blue-600 dark:text-blue-400">staff@resolveai.com</span> (pw: staff123)
              </p>
              <p>
                • User: <span className="font-semibold text-emerald-600 dark:text-emerald-400">user@resolveai.com</span> (pw: user123)
              </p>
              <p>
                • Admin: <span className="font-semibold text-amber-600 dark:text-amber-400">admin@resolveai.com</span> (pw: admin123)
              </p>
            </div>
            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors"
            >
              Return to Login
            </button>
          </div>
        </div>
      )}

      {/* Google Sign-in Interactive Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-slate-900 dark:text-white transition-all">
            {/* Modal Close Button */}
            <button
              onClick={() => {
                setShowGoogleModal(false);
                setPasskeyError(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* STEP 1: ACCOUNTS LIST */}
            {googleModalStep === "accounts" && (
              <div>
                {/* Google Brand Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Choose an account</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">to continue to ResolveAI Incident Resolution</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mb-3.5">
                  Select a logged-in Google Workspace account on this device:
                </p>

                {/* Saved Logged In Accounts List */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 mb-4">
                  {savedAccounts.map((acc) => {
                    const isPrivileged = acc.role === "ADMIN";
                    const roleLabel =
                      acc.role === "ADMIN"
                        ? "Administrator"
                        : acc.role === "STAFF" || acc.role === "TECHNICIAN"
                        ? "IT Technician"
                        : "Employee User";

                    const badgeColor =
                      acc.role === "ADMIN"
                        ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                        : acc.role === "STAFF" || acc.role === "TECHNICIAN"
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60"
                        : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60";

                    const avatarBg =
                      acc.role === "ADMIN"
                        ? "bg-gradient-to-tr from-amber-600 to-orange-500"
                        : acc.role === "STAFF" || acc.role === "TECHNICIAN"
                        ? "bg-gradient-to-tr from-blue-600 to-indigo-600"
                        : "bg-gradient-to-tr from-emerald-600 to-teal-500";

                    const initials = acc.name
                      ? acc.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : acc.email.slice(0, 2).toUpperCase();

                    return (
                      <div
                        key={acc.email}
                        onClick={() => void handleSelectAccount(acc)}
                        className="w-full p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-left flex items-center justify-between transition-all group cursor-pointer hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full ${avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{acc.name}</p>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}
                              >
                                {roleLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{acc.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {isPrivileged && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                              <Key className="w-3 h-3 text-amber-500" />
                              Passkey
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleRemoveAccount(e, acc.email)}
                            title="Remove account from device"
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add another corporate account button */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setNewAccountEmail("");
                      setNewAccountName("");
                      setNewAccountRole("USER");
                      setGoogleModalStep("add_account");
                    }}
                    className="w-full py-2.5 px-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-slate-850 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 font-semibold text-xs transition-all flex items-center justify-center gap-2 group"
                  >
                    <Plus className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    <span>Use another corporate Google account</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: ADD / ENTER CORPORATE GOOGLE ACCOUNT */}
            {googleModalStep === "add_account" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {savedAccounts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setGoogleModalStep("accounts")}
                        className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                        title="Back to accounts"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                        Sign in with Google
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Corporate workspace authentication</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mb-3.5">
                  Enter your organization's Google email address:
                </p>

                <form onSubmit={handleProceedWithNewAccount} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Corporate Google Email
                    </label>
                    <input
                      type="email"
                      required
                      value={newAccountEmail}
                      onChange={(e) => {
                        setNewAccountEmail(e.target.value);
                        setPasskeyError(null);
                      }}
                      placeholder="e.g. yourname@company.com"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Account Role
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewAccountRole("USER")}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          newAccountRole === "USER"
                            ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        <p className="text-xs">Employee</p>
                        <p className="text-[10px] opacity-75">Self-service</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewAccountRole("STAFF")}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          newAccountRole === "STAFF"
                            ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-800 dark:text-blue-300 font-bold shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        <p className="text-xs">IT Staff</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Technician</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewAccountRole("ADMIN")}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          newAccountRole === "ADMIN"
                            ? "bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-800 dark:text-amber-300 font-bold shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        <p className="text-xs">Admin</p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Passkey req.</p>
                      </button>
                    </div>
                  </div>

                  {newAccountRole === "ADMIN" && (
                    <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs">
                      <Key className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Administrator role: You will enter your 6-digit security passkey on the next step.</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!newAccountEmail || googleSigningIn}
                    className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {newAccountRole === "ADMIN"
                      ? "Proceed to Passkey Verification"
                      : `Continue as ${newAccountRole === "STAFF" ? "IT Staff" : "Employee"}`}
                  </button>
                </form>
              </div>
            )}

            {/* STEP 3: 6-DIGIT PASSKEY VERIFICATION */}
            {googleModalStep === "passkey" && targetAccount && (
              <div>
                {/* Header with back navigation */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleModalStep(savedAccounts.length > 0 ? "accounts" : "add_account");
                      setPasskeyError(null);
                    }}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                    title="Back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Security Passkey</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Privileged access identity verification</p>
                  </div>
                </div>

                {/* Target Account Summary Pill */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full ${
                        targetAccount.role === "ADMIN" ? "bg-amber-600" : "bg-blue-600"
                      } text-white font-bold text-xs flex items-center justify-center shrink-0`}
                    >
                      {targetAccount.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{targetAccount.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{targetAccount.email}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      targetAccount.role === "ADMIN"
                        ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                        : "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60"
                    }`}
                  >
                    {targetAccount.role === "ADMIN" ? "Administrator" : "IT Staff"}
                  </span>
                </div>

                {/* Instructions */}
                <div className="text-center mb-4">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-2 shadow-sm">
                    <Key className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Enter Administrator Passkey</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Enter your 6-digit security passkey to access{" "}
                    <strong className="text-slate-700 dark:text-slate-200">Administrator Dashboard</strong>.
                  </p>
                </div>

                {/* 6 Digit Inputs */}
                <div className="flex items-center justify-center gap-2 mb-3" onPaste={handlePinPaste}>
                  {passkeyDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (pinInputRefs.current[idx] = el)}
                      type={showPasskey ? "text" : "password"}
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(idx, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      className={`w-11 h-13 text-center text-xl font-bold rounded-xl border ${
                        passkeyError
                          ? "border-red-400 bg-red-50/50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                          : digit
                          ? "border-blue-600 bg-blue-50/20 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-sm"
                          : "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all`}
                    />
                  ))}
                </div>

                {/* Toggle Show/Hide Passkey & Passkey Hint */}
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4 px-1">
                  <button
                    type="button"
                    onClick={() => setShowPasskey(!showPasskey)}
                    className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                  >
                    {showPasskey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPasskey ? "Hide digits" : "Show digits"}</span>
                  </button>

                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    Any 6-digit passkey accepted
                  </span>
                </div>

                {/* Error message */}
                {passkeyError && (
                  <div className="mb-4 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passkeyError}</span>
                  </div>
                )}

                {/* Verify & Login Button */}
                <button
                  type="button"
                  onClick={() => void handleVerifyPasskey()}
                  disabled={passkeyLoading || passkeyDigits.join("").length !== 6}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {passkeyLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying passkey...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify & Access Administrator</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Administrator Security Passkey Modal (prompted AFTER logging in with admin email) */}
      {showAdminPasskeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-slate-900 dark:text-white transition-all">
            {/* Modal Close Button */}
            <button
              onClick={() => {
                setShowAdminPasskeyModal(false);
                setPendingAdminAuth(null);
                setAdminPasskeyError(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0 shadow-sm text-amber-600 dark:text-amber-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Administrator Passkey
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Step 2: Security Passkey Verification</p>
              </div>
            </div>

            {/* Target Account Summary Pill */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  AD
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    System Administrator
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {pendingAdminAuth?.email || email || "admin@resolveai.com"}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60">
                Administrator
              </span>
            </div>

            {/* Instructions */}
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-2 shadow-sm">
                <Key className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Enter 6-Digit Passkey</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Logged in with email successfully. Please enter your 6-digit security passkey to access the{" "}
                <strong className="text-slate-700 dark:text-slate-200">Administrator Dashboard</strong>.
              </p>
            </div>

            {/* 6 Digit Inputs */}
            <div className="flex items-center justify-center gap-2 mb-3" onPaste={handleAdminPinPaste}>
              {adminPasskeyDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (adminPinInputRefs.current[idx] = el)}
                  type={showAdminPasskey ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleAdminPinChange(idx, e.target.value)}
                  onKeyDown={(e) => handleAdminPinKeyDown(idx, e)}
                  autoFocus={idx === 0}
                  className={`w-11 h-13 text-center text-xl font-bold rounded-xl border ${
                    adminPasskeyError
                      ? "border-red-400 bg-red-50/50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                      : digit
                      ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/40 text-slate-900 dark:text-white shadow-sm"
                      : "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  } focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all`}
                />
              ))}
            </div>

            {/* Toggle Show/Hide Passkey & Passkey Hint */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4 px-1">
              <button
                type="button"
                onClick={() => setShowAdminPasskey(!showAdminPasskey)}
                className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                {showAdminPasskey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showAdminPasskey ? "Hide digits" : "Show digits"}</span>
              </button>

              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                Any 6-digit passkey accepted
              </span>
            </div>

            {/* Error message */}
            {adminPasskeyError && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adminPasskeyError}</span>
              </div>
            )}

            {/* Verify & Login Button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleVerifyAdminPasskey()}
                disabled={adminPasskeyLoading || adminPasskeyDigits.join("").length !== 6}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {adminPasskeyLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying passkey...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Access Administrator Dashboard</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAdminPasskeyModal(false);
                  setPendingAdminAuth(null);
                  setAdminPasskeyError(null);
                }}
                className="w-full py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
