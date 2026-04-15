"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Profile } from "./types";
import { listProfiles } from "./api";

interface ProfileContextType {
  profiles: Profile[];
  activeProfile: Profile | null;
  setActiveProfileId: (id: number) => void;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({
  profiles: [],
  activeProfile: null,
  setActiveProfileId: () => {},
  refreshProfiles: async () => {},
});

const STORAGE_KEY = "pts_active_profile_id";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const refreshProfiles = useCallback(async () => {
    try {
      const data = await listProfiles();
      setProfiles(data);

      // If there's a stored ID, validate it still exists
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        const id = Number(storedId);
        if (data.some((p) => p.id === id)) {
          setActiveId(id);
          return;
        }
      }
      // Default to first profile
      if (data.length > 0) {
        setActiveId(data[0].id);
        localStorage.setItem(STORAGE_KEY, String(data[0].id));
      }
    } catch {
      // Backend may not have profiles yet; ignore
    }
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  function setActiveProfileId(id: number) {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }

  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  return (
    <ProfileContext.Provider
      value={{ profiles, activeProfile, setActiveProfileId, refreshProfiles }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
