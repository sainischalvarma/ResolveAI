export interface SavedAccount {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF" | "TECHNICIAN" | "USER";
  profileImage?: string;
  department?: string;
  passkey?: string;
  lastLogin: string;
}

export const SAVED_ACCOUNTS_STORAGE_KEY = "resolveai_logged_in_accounts";

export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAccountToStorage(user: {
  id?: string;
  email: string;
  name?: string;
  role?: string;
  profileImage?: string;
  department?: string;
  passkey?: string;
}): SavedAccount {
  const list = getSavedAccounts();
  const normalizedEmail = (user.email || "").toLowerCase().trim();
  const existingIdx = list.findIndex(
    (a) => a.email.toLowerCase().trim() === normalizedEmail
  );

  const roleValue = (user.role as any) || "USER";
  const updatedItem: SavedAccount = {
    id:
      user.id ||
      "acc-" +
        Math.abs(
          normalizedEmail.split("").reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
        ),
    email: normalizedEmail,
    name: user.name?.trim() || normalizedEmail.split("@")[0] || "User",
    role: roleValue,
    profileImage: user.profileImage,
    department: user.department,
    passkey: user.passkey,
    lastLogin: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...updatedItem };
  } else {
    list.unshift(updatedItem);
  }

  localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(list));
  return updatedItem;
}

export function removeSavedAccountFromStorage(email: string): SavedAccount[] {
  const list = getSavedAccounts();
  const normalizedEmail = (email || "").toLowerCase().trim();
  const updated = list.filter(
    (a) => a.email.toLowerCase().trim() !== normalizedEmail
  );
  localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
