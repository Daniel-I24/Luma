import type { Provider } from '@angular/core';
import { RealtimeService } from '@core/realtime/realtime.service';
import { FakeRealtimeService } from './testing/fake-realtime';

/**
 * Providers of every unit test (angular.json "providersFile"): screens that
 * listen to Realtime get the fake, so no test opens a socket. A spec can
 * still provide the real service (src/app/core/realtime).
 */
const providers: Provider[] = [FakeRealtimeService, { provide: RealtimeService, useExisting: FakeRealtimeService }];
export default providers;
