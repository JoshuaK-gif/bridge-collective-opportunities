// ============================================================
// types.ts — Domain types for the user data pipeline
// ============================================================

interface RawUser {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  tags: string[];
  email?: string;
}

interface StoredUser {
  id: string;
  fullName: string;
  age: number;
  isAdult: boolean;
  tags: string[];
  email: string | null;
}

// ============================================================
// api.ts — External data retrieval
// ============================================================

async function fetchRawUser(userId: string): Promise<RawUser> {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user ${userId}: ${response.status}`);
  }
  return response.json() as Promise<RawUser>;
}

// ============================================================
// transform.ts — Business logic / mapping
// ============================================================

function computeAge(dob: string): number {
  return new Date().getFullYear() - new Date(dob).getFullYear();
}

function formatUser(raw: RawUser): StoredUser {
  const age = computeAge(raw.dob);
  return {
    id: raw.id,
    fullName: `${raw.firstName} ${raw.lastName}`,
    age,
    isAdult: age >= 18,
    tags: raw.tags.map((t) => t.toLowerCase()),
    email: raw.email?.toLowerCase() ?? null,
  };
}

// ============================================================
// storage.ts — Persistence
// ============================================================

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

async function writeUser(user: StoredUser): Promise<void> {
  const path = join("users", `${user.id}.json`);
  await writeFile(path, JSON.stringify(user, null, 2), "utf-8");
}

// ============================================================
// processUser.ts — Orchestrator (keeps the public API)
// ============================================================

async function processUserData(userId: string): Promise<StoredUser> {
  const raw = await fetchRawUser(userId);
  const formatted = formatUser(raw);
  await writeUser(formatted);
  return formatted;
}
