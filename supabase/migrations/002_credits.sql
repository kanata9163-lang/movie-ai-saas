-- Credit system tables

-- Workspace credit balances
CREATE TABLE IF NOT EXISTS workspace_credits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  balance int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Credit transaction history
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount int NOT NULL, -- positive = add, negative = deduct
  balance_after int NOT NULL,
  type text NOT NULL, -- 'initial', 'purchase', 'usage', 'bonus'
  description text,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE workspace_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON workspace_credits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON credit_transactions FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_workspace ON credit_transactions(workspace_id, created_at DESC);
