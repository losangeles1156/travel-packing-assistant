import { createClient } from '@supabase/supabase-js';
import { CLOUD_FEATURES_ENABLED } from './featureFlags';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Optional legacy cloud features stay dormant even if old deployment variables exist.
if (CLOUD_FEATURES_ENABLED && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Cloud collaboration is not configured.');
}
export const supabase = CLOUD_FEATURES_ENABLED && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { realtime: { params: { eventsPerSecond: 10 } } })
  : null;
