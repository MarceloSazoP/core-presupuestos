// User
export interface User {
  id: string;
  phone: string;
  email: string;
  name: string;
  logo_url?: string;
  signature_url?: string;
  created_at: string;
  updated_at: string;
}

// Customer
export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Quote
export type DocStatus = 'DRAFT' | 'PENDING' | 'FINALIZED';
export type CommercialStatus = 'NONE' | 'SENT' | 'FOLLOW_UP' | 'ACCEPTED' | 'REJECTED';

export interface Quote {
  id: string;
  user_id: string;
  customer_id: string;
  doc_status: DocStatus;
  commercial_status: CommercialStatus;
  quote_number?: string;
  title?: string;
  description?: string;
  service_location?: string;
  subtotal: number;
  discount: number;
  total: number;
  warranty?: string;
  validity_days: number;
  notes?: string;
  public_access_key?: string;
  edit_access_key?: string;
  created_at: string;
  updated_at: string;
  finalized_at?: string;
  sent_at?: string;
}

// Quote Item
export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  created_at: string;
}

// Quote Survey
export interface QuoteSurvey {
  id: string;
  quote_id: string;
  notes?: string;
  measurements?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_address?: string;
  created_at: string;
  updated_at: string;
}

// Quote Photo
export interface QuotePhoto {
  id: string;
  quote_id: string;
  photo_url: string;
  caption?: string;
  sort_order: number;
  created_at: string;
}

// Quote Voice Note
export interface QuoteVoiceNote {
  id: string;
  quote_id: string;
  audio_url: string;
  duration_seconds?: number;
  created_at: string;
}

// Follow Up
export interface FollowUp {
  id: string;
  quote_id: string;
  user_id: string;
  next_contact_date?: string;
  notes?: string;
  contact_method?: 'CALL' | 'WHATSAPP' | 'EMAIL';
  created_at: string;
  updated_at: string;
}

// Verification Code
export interface VerificationCode {
  id: string;
  phone_or_email: string;
  code: string;
  attempt_count: number;
  expires_at: string;
  verified_at?: string;
  created_at: string;
}
