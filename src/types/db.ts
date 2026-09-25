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
  motto: string | null;
};

export type UserScore = {
  user_id: string;
  display_name: string | null;
  team_id: string | null;
  team_name: string | null;
  color: string | null;
  score: number;
};

export type BingoTask = {
  id: string;
  position: number;
  title: string;
  description: string;
  points: number;
  active: boolean;
};

export type BingoSubmission = {
  id: string;
  team_id: string;
  user_id: string;
  task_id: string;
  photo_path: string;
  caption: string | null;
  status: UserStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export type Registration = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  sms_consent: boolean;
  diet_notes: string | null;
  proof_path: string;
  ocr_text: string | null;
  ocr_confidence: number | null;
  ocr_keywords_hit: number;
  status: UserStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export type ShopKind = "digital" | "physical";
export type ShopOrderStatus = "pending" | "fulfilled" | "cancelled";

export type ShopItem = {
  id: string;
  name: string;
  description: string;
  kind: ShopKind;
  price: number;
  /** NULL znaczy bez limitu. */
  stock: number | null;
  active: boolean;
  effect_key: string | null;
  effect_value: number | null;
  effect_hours: number | null;
  /**
   * Czy zakup wymaga wskazania drużyny. Kolumna, nie reguła w kodzie klienta:
   * front-end pokazuje wybór celu, bo pozycja tak mówi, a nie bo ktoś zaszył
   * w komponencie, że klątwa jest szczególna.
   */
  requires_target: boolean;
  position: number;
  /**
   * Klucz kształtu dla `IkonaPozycji`. NULL albo klucz nieznany komponentowi
   * daje neutralny znak, więc pozycja dołożona zapytaniem nigdy nie rozsypie
   * półki.
   */
  ikona: string | null;
};

export type ShopOrder = {
  id: string;
  team_id: string;
  item_id: string;
  price_paid: number;
  ordered_by: string | null;
  target_team_id: string | null;
  status: ShopOrderStatus;
  fulfilled_by: string | null;
  fulfilled_at: string | null;
  note: string | null;
  created_at: string;
};

export type ActiveEffect = {
  id: string;
  scope: "user" | "team";
  subject_id: string;
  effect_key: string;
  effect_value: number | null;
  expires_at: string | null;
  consumed_at: string | null;
  order_id: string | null;
  created_at: string;
};

/** Wiersz widoku `kronika_sklepiku` — nazwy rozwiązane po stronie bazy. */
export type WpisKroniki = {
  id: string;
  created_at: string;
  status: ShopOrderStatus;
  price_paid: number;
  note: string | null;
  item_name: string;
  item_kind: ShopKind;
  team_name: string;
  team_color: string;
  target_team_name: string | null;
  ordered_by_name: string | null;
};
