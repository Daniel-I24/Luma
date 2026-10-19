import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { LanguageService } from '@core/i18n/language.service';
import { NativeShell } from '@core/native/native-shell';
import { onRouteTransitionCreated } from '@core/navigation/route-transition';
import { routes } from './app.routes';
import { TranslocoHttpLoader } from './transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: onRouteTransitionCreated,
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
    // Activate the stored language before the first render (no flash of Spanish).
    provideAppInitializer(() => inject(LanguageService).init()),
    // Android back button and keyboard (no-op on the web). Never blocks startup:
    // if a plugin fails to load, the app keeps the plain web behaviour.
    provideAppInitializer(() => {
      inject(NativeShell)
        .init()
        .catch(() => undefined);
    }),
  ],
};
