export type Role = "SUPER_ADMIN" | "LANDLORD" | "STAFF" | "TENANT";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  accountId?: string;
  tenantId?: string;
  accountName?: string;
}

export interface DashboardStats {
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  totalTenants: number;
}

export interface PaymentWithTenant {
  id: string;
  amount: number;
  month: string;
  dueDate: Date;
  paidDate: Date | null;
  status: string;
  proofUrl: string | null;
  method: string | null;
  notes: string | null;
  tenant: {
    id: string;
    name: string;
    phone: string;
    unit: {
      unitNumber: string;
      property: { name: string };
    };
  };
}

export interface TenantWithUnit {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  moveInDate: Date;
  isActive: boolean;
  unit: {
    id: string;
    unitNumber: string;
    rentAmount: number;
    property: { id: string; name: string };
  };
  payments: Array<{ status: string; month: string; amount: number }>;
}

export interface PropertyWithUnits {
  id: string;
  name: string;
  address: string;
  type: string;
  isListed: boolean;
  listingStatus: string;
  units: Array<{
    id: string;
    unitNumber: string;
    rentAmount: number;
    status: string;
    tenants: Array<{ id: string; name: string }>;
  }>;
}

export type PlanName = "Free" | "Basic" | "Pro" | "Enterprise";

export interface PlanFeatures {
  smsReminders: boolean;
  paymentProof: boolean;
  publicListings: boolean;
  maintenance: boolean;
  exportPdf: boolean;
  apiAccess: boolean;
  whiteLabelBranding: boolean;
}
