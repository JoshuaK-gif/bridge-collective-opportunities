import { ApiUser, FormattedUser } from '../types/user';

function calculateAge(dob: string): number {
  return new Date().getFullYear() - new Date(dob).getFullYear();
}

export function mapToFormattedUser(apiUser: ApiUser): FormattedUser {
  const age = calculateAge(apiUser.dob);
  return {
    id: apiUser.id,
    fullName: `${apiUser.firstName} ${apiUser.lastName}`,
    age,
    isAdult: age >= 18,
    tags: apiUser.tags.map((t: string) => t.toLowerCase()),
    email: apiUser.email?.toLowerCase(),
  };
}
