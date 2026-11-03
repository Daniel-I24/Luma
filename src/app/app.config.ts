import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { TRANSLOCO_TRANSPILER, provideTransloco } from '@jsverse/transloco';
import { PluralTranspiler } from '@core/i18n/plural-transpiler';
import { LanguageService } from '@core/i18n/language.service';
import { ConnectivityService } from '@core/network/connectivity.service';
import { AppEvents } from '@core/native/app-events';
import { NativeShell } from '@core/native/native-device';
import { PushRegistration } from '@core/push/push-registration.service';
import { UpdateCheck } from '@core/update/update-check.service';
import { AppErrorHandler } from '@shared/errors/app-error-handler';
import { PaymentReturn } from '@shared/payments/payment-return';
import { RouteTransition } from '@core/navigation/route-transition';
import { routes } from './app.routes';
import { TranslocoHttpLoader } from './transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Unhandled errors show a friendly notice instead of a blank screen.
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: RouteTransition.onRouteTransitionCreated,
      }),
    ),
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: ['es', 'en'],
        defaultLang: 'es',
        // Remove this option if your application doesn't support changing language in runtime.
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // "{{count:reseña|reseñas}}": texts that read right with 1 (core/i18n/plural-transpiler.ts).
    { provide: TRANSLOCO_TRANSPILER, useClass: PluralTranspiler },
    // Activate the stored language before the first render (no flash of Spanish).
    provideAppInitializer(() => inject(LanguageService).init()),
    // Android back button and keyboard (no-op on the web). Never blocks startup:
    // if a plugin fails to load, the app keeps the plain web behaviour.
    provideAppInitializer(() => {
      inject(NativeShell)
        .init()
        .catch(() => undefined);
      inject(ConnectivityService)
        .watchNative()
        .catch(() => undefined);
      // Push: never asks for permission here, only refreshes a granted token.
      inject(PushRegistration)
        .init()
        .catch(() => undefined);
      // Resume and luma:// links (Wompi's return after paying).
      inject(PaymentReturn).init();
      inject(AppEvents)
        .init()
        .catch(() => undefined);
      // Newer version on the site? Never delays or blocks the start.
      void inject(UpdateCheck).check();
    }),
  ],
};
