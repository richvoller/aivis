import "server-only";
import { getAdminClient } from "./supabase/admin";
import { loadDemoBrandDataForClient, DEMO_BRAND_DOMAIN, DEMO_BRAND_NAME } from "./demo-data-seed";

export { DEMO_BRAND_DOMAIN, DEMO_BRAND_NAME, loadDemoBrandDataForClient };

export async function loadDemoBrandData(): Promise<string> {
  return loadDemoBrandDataForClient(getAdminClient());
}
