// Day totals and bill changes returned by /api/summary and /api/fee-changes

export interface MoneyCount {
  count: number;
  amount: number;
}

export interface DaySummary {
  date: string;
  patients: number;
  notBilled: number;
  split: number;
  feeChanges?: number;
  cash: MoneyCount;
  upi: MoneyCount;
  total: MoneyCount;
  services: Record<string, MoneyCount>;
}

export interface FeeChange {
  visitId: string;
  patientName: string;
  patientId: string;
  token: string;
  at: string;
  by: string;
  kind: string;
  beforeTotal: number;
  afterTotal: number;
  beforeFees: Record<string, number>;
  afterFees: Record<string, number>;
  beforeCash: number;
  beforeUpi: number;
  afterCash: number;
  afterUpi: number;
}
