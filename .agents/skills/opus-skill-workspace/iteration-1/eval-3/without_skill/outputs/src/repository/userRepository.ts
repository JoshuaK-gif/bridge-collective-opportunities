import fs from 'node:fs/promises';
import path from 'node:path';
import { FormattedUser } from '../types/user';

const STORAGE_DIR = path.resolve('./users');

export async function saveUser(user: FormattedUser): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(STORAGE_DIR, `${user.id}.json`),
    JSON.stringify(user, null, 2),
  );
}

export async function getUser(userId: string): Promise<FormattedUser | null> {
  try {
    const raw = await fs.readFile(path.join(STORAGE_DIR, `${userId}.json`), 'utf-8');
    return JSON.parse(raw) as FormattedUser;
  } catch {
    return null;
  }
}
