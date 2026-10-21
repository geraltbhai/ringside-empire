/**
 * Seeds a starter universe into Supabase cloud saves for one user.
 * Server-side only — uses the service-role key, which must never be exposed to the browser.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SEED_USER_ID=<auth user uuid> npm run seed:supabase
 */
import { createClient } from "@supabase/supabase-js";
import { serializeUniverse } from "../src/engine/schema";
import { startUniverse } from "../src/engine/universe";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.SEED_USER_ID;

if (!url || !key || !userId) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_USER_ID.");
  process.exit(1);
}

const universe = startUniverse({
  name: "Starter universe",
  promotionName: "Apex Wrestling Alliance",
  startDate: new Date().toISOString().slice(0, 10),
  startingCash: 5_000_000,
  difficulty: "normal",
  seed: 20261021,
});

async function main() {
  const supabase = createClient(url!, key!, { auth: { persistSession: false } });
  const { error } = await supabase.from("universe_saves").upsert(
  {
    user_id: userId,
    slot: "starter",
    name: `${universe.promotionName} — ${universe.name}`,
    week: universe.week,
    schema_version: universe.schemaVersion,
    data: JSON.parse(serializeUniverse(universe)),
    updated_at: new Date().toISOString(),
  },
  { onConflict: "user_id,slot" },
);
  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
  console.log(`Seeded "starter" save (${Object.keys(universe.wrestlers).length} wrestlers) for user ${userId}.`);
}

void main();
