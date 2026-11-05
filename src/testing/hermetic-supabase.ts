import { createFakeSupabase } from './fake-supabase';

const NO_BACKEND = { message: 'no_backend_in_tests' };

/**
 * The Supabase client of every unit test that does not bring its own: no
 * network, no storage, no session, so a test can never reach a real project.
 * Reads answer empty and everything else answers an error, like an empty
 * backend would. Test-only (excluded from the app build).
 */
export function createHermeticSupabase() {
  const fail = async () => ({ data: null, error: NO_BACKEND });
  const channel = { on: () => channel, subscribe: () => channel, unsubscribe: async () => 'ok' };
  return {
    ...createFakeSupabase().client,
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signInWithPassword: fail,
      signUp: fail,
      signOut: async () => ({ error: null }),
      updateUser: fail,
      verifyOtp: fail,
      resend: fail,
      resetPasswordForEmail: fail,
      reauthenticate: fail,
      mfa: { listFactors: fail, enroll: fail, unenroll: fail, challengeAndVerify: fail },
    },
    functions: { invoke: fail },
    storage: {
      from: () => ({ upload: fail, remove: fail, createSignedUrl: fail, getPublicUrl: () => ({ data: { publicUrl: '' } }) }),
    },
    channel: () => channel,
    removeChannel: async () => 'ok',
  };
}
