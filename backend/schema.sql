-- CorePresupuesto Database Schema
-- PostgreSQL

-- Drop existing tables (use with caution in development only)
-- DROP TABLE IF EXISTS audit_log CASCADE;
-- DROP TABLE IF EXISTS follow_ups CASCADE;
-- DROP TABLE IF EXISTS quote_voice_notes CASCADE;
-- DROP TABLE IF EXISTS quote_photos CASCADE;
-- DROP TABLE IF EXISTS quote_survey CASCADE;
-- DROP TABLE IF EXISTS quote_items CASCADE;
-- DROP TABLE IF EXISTS quotes CASCADE;
-- DROP TABLE IF EXISTS customers CASCADE;
-- DROP TABLE IF EXISTS verification_codes CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  signature_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  doc_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  commercial_status VARCHAR(20) NOT NULL DEFAULT 'NONE',

  quote_number VARCHAR(50) UNIQUE,
  title VARCHAR(255),
  description TEXT,
  service_location TEXT,

  subtotal DECIMAL(12, 2) DEFAULT 0,
  discount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,

  warranty TEXT,
  validity_days INT DEFAULT 30,
  notes TEXT,

  public_access_key VARCHAR(64) UNIQUE,
  edit_access_key VARCHAR(64) UNIQUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  finalized_at TIMESTAMP,
  sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_doc_status ON quotes(doc_status);
CREATE INDEX IF NOT EXISTS idx_quotes_commercial_status ON quotes(commercial_status);

-- Quote Items
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,

  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

-- Quote Survey
CREATE TABLE IF NOT EXISTS quote_survey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE,

  notes TEXT,
  measurements TEXT,
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  gps_address TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_quote_id ON quote_survey(quote_id);

-- Quote Photos
CREATE TABLE IF NOT EXISTS quote_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  photo_url TEXT NOT NULL,
  caption TEXT,
  sort_order INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_quote_id ON quote_photos(quote_id);

-- Quote Voice Notes
CREATE TABLE IF NOT EXISTS quote_voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  audio_url TEXT NOT NULL,
  duration_seconds INT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_notes_quote_id ON quote_voice_notes(quote_id);

-- Follow Ups
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  next_contact_date DATE,
  notes TEXT,
  contact_method VARCHAR(20),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_quote_id ON follow_ups(quote_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_next_contact ON follow_ups(next_contact_date);

-- Verification Codes
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_or_email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  attempt_count INT DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_phone_or_email ON verification_codes(phone_or_email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  action VARCHAR(50),
  changes JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
