export interface ApiUser {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  tags: string[];
  email?: string;
}

export interface FormattedUser {
  id: string;
  fullName: string;
  age: number;
  isAdult: boolean;
  tags: string[];
  email?: string;
}
