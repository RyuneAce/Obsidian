export interface LedgerEntry {
  id: string;
  name: string;
  item: string;
  amount: number;
  timestamp: string;
}

export type FilterType = 'all' | 'year' | 'month' | 'day';

export interface LedgerFilter {
  type: FilterType;
  date: Date | null;
  name: string;
}
