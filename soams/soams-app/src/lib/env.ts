// Central environment handling.
// The scaffold runs WITHOUT Supabase configured: every page then renders a
// friendly setup notice instead of crashing. Copy .env.local.example to
// .env.local and fill in your project values to go live.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-ref') &&
  supabaseAnonKey.length > 20;
