import { ApiUser } from '../types/user';

export async function fetchUserFromApi(userId: string): Promise<ApiUser> {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user ${userId}: ${response.statusText}`);
  }
  return response.json() as Promise<ApiUser>;
}
