import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("supabase/schema.sql", "utf8");

describe("Supabase RLS schema", () => {
  it("enables row level security on organization-scoped tables", () => {
    expect(schema).toContain("alter table organizations enable row level security;");
    expect(schema).toContain("alter table transactions enable row level security;");
  });

  it("uses auth.uid ownership checks for organization access", () => {
    expect(schema).toContain("owner_user_id = auth.uid()");
    expect(schema).toContain("organizations.owner_user_id = auth.uid()");
  });

  it("allows transaction insert/select/update only through the user's organization", () => {
    expect(schema).toContain('create policy "Users can read organization transactions"');
    expect(schema).toContain('create policy "Users can insert organization transactions"');
    expect(schema).toContain('create policy "Users can update organization transactions"');
  });

  it("creates organizations on auth signup without requiring a service role key in app code", () => {
    expect(schema).toContain("create_organization_for_new_user");
    expect(schema).toContain("after insert on auth.users");
    expect(schema).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
  });
});
