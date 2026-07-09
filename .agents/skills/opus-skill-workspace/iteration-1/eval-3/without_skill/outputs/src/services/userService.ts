import { fetchUserFromApi } from '../api/client';
import { mapToFormattedUser } from '../mappers/userMapper';
import { saveUser } from '../repository/userRepository';

export async function processUserData(userId: string): Promise<void> {
  const apiUser = await fetchUserFromApi(userId);
  const formatted = mapToFormattedUser(apiUser);
  await saveUser(formatted);
}
