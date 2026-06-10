import type { RiskLevel, TransactionInput } from "./types";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          owner_user_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          owner_user_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          owner_user_id?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          org_id: string;
          upload_batch_id: string;
          created_at: string;
          raw_csv_row: TransactionInput;
          risk_score: number;
          risk_level: RiskLevel;
          flags: string[] | null;
          score_breakdown: unknown;
          reviewed: boolean;
          reviewer_note: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          upload_batch_id: string;
          created_at?: string;
          raw_csv_row: TransactionInput;
          risk_score: number;
          risk_level: RiskLevel;
          flags?: string[] | null;
          score_breakdown?: unknown;
          reviewed?: boolean;
          reviewer_note?: string | null;
        };
        Update: {
          reviewed?: boolean;
          reviewer_note?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
