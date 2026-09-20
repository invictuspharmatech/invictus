import { Role } from "@/lib/enums";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isAffiliate: boolean;
  affiliateCode: string | null;
};
