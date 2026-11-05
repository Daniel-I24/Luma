import type { Provider } from '@angular/core';
import { RealtimeService } from '@core/realtime/realtime.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { FakeRealtimeService } from './testing/fake-realtime';
import { createHermeticSupabase } from './testing/hermetic-supabase';

/**
 * Providers of every unit test (angular.json "providersFile"). Screens that
 * listen to Realtime get the fake, so no test opens a socket, and Supabase is
 * a client without network: no test can reach a real project. A spec can still
 * provide its own. The build of the tests replaces environment.ts by the
 * placeholder file (angular.json, build configuration "test").
 */
const providers: Provider[] = [
  FakeRealtimeService,
  { provide: RealtimeService, useExisting: FakeRealtimeService },
  { provide: SupabaseService, useFactory: () => ({ client: createHermeticSupabase() }) },
];
export default providers;
