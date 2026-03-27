export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
  credits: number;
  plan: "FREE" | "STARTER" | "PRO" | "BUSINESS";
}

export interface CreatedEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  googleEventId?: string;
  htmlLink?: string;
}

export interface VoiceAction {
  id: string;
  rawText: string;
  events: CreatedEvent[];
  createdAt: string;
}

export interface CreditTransaction {
  id: string;
  type: "SIGNUP_BONUS" | "PURCHASE" | "USAGE" | "ADMIN_GRANT" | "SUBSCRIPTION_RENEWAL";
  amount: number;
  balance: number;
  description: string | null;
  createdAt: string;
}

export interface UsageData {
  credits: number;
  plan: string;
  subscription: {
    status: string | null;
    isActive: boolean;
    currentPeriodEnd: string | null;
  };
  canBuyTopUp: boolean;
  usage: {
    today: number;
    week: number;
    month: number;
    avgPerDay: number;
  };
  transactions: CreditTransaction[];
}

export interface SubscriptionManagementData {
  hasManagedSubscription: boolean;
  currentPlan: string;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  scheduledPlan: string | null;
  scheduledPlanEffectiveDate: string | null;
}

export interface PlanInfo {
  id: string;
  name: string;
  price: number;
  credits: number;
  description: string;
}

export interface TopUpPackInfo {
  id: string;
  name: string;
  price: number;
  credits: number;
  description: string;
}

export interface AdminStats {
  users: {
    total: number;
    planDistribution: Array<{ plan: string; count: number }>;
  };
  actions: {
    total: number;
    today: number;
    week: number;
    month: number;
  };
  revenue: {
    total: number;
    month: number;
  };
  apiCosts: {
    estimatedTotal: number;
    estimatedMonth: number;
    costPerCall: number;
  };
  margin: {
    totalRevenue: number;
    totalCosts: number;
    netProfit: number;
  };
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  credits: number;
  plan: string;
  createdAt: string;
  _count: { voiceActions: number; payments: number };
}

export interface AdminOverviewResponse {
  stats: AdminStats;
  users: AdminUser[];
}
