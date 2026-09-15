export type UserRole = "member" | "admin";
export type UserStatus = "pending" | "approved" | "rejected";

export type Team = {
  id: string;
  name: string;
  slug: string;
  color: string;
  motto: string | null;
  captain_id: string | null;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  sms_consent: boolean;
  team_id: string | null;
  role: UserRole;
  status: UserStatus;
  notes: string | null;
};

export type TeamScore = {
  team_id: string;
  name: string;
  slug: string;
  color: string;
  score: number;
};

export type UserScore = {
  user_id: string;
  display_name: string | null;
  team_id: string | null;
  team_name: string | null;
  color: string | null;
  score: number;
};
