export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          currency: string;
          pay_date: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          currency?: string;
          pay_date?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          currency?: string;
          pay_date?: number;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          description: string;
          amount: number;
          category: string;
          merchant: string;
          type: 'debit' | 'credit';
          notes: string;
          is_recurring: boolean;
          source: 'manual' | 'csv' | 'receipt';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          description: string;
          amount: number;
          category?: string;
          merchant?: string;
          type?: 'debit' | 'credit';
          notes?: string;
          is_recurring?: boolean;
          source?: 'manual' | 'csv' | 'receipt';
          created_at?: string;
        };
        Update: {
          date?: string;
          description?: string;
          amount?: number;
          category?: string;
          merchant?: string;
          type?: 'debit' | 'credit';
          notes?: string;
          is_recurring?: boolean;
        };
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          monthly_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          monthly_limit: number;
        };
        Update: {
          category?: string;
          monthly_limit?: number;
          updated_at?: string;
        };
      };
      user_context: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          value: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key: string;
          value: string;
        };
        Update: {
          key?: string;
          value?: string;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Budget = Database['public']['Tables']['budgets']['Row'];
export type UserContext = Database['public']['Tables']['user_context']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
