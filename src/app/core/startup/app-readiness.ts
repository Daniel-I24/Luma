import { Injectable, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';

/**
 * AppReadiness — resolves when the first screen can be shown: the persisted
 * session has been restored and the first navigation has settled (its guards
 * and lazy chunk included). Never rejects.
 */
@Injectable({ providedIn: 'root' })
export class AppReadiness {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  public readonly ready: Promise<void> = this.waitForFirstScreen();

  private async waitForFirstScreen(): Promise<void> {
    const firstNavigation = firstValueFrom(
      this.router.events.pipe(
        filter((e) => e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError),
        take(1),
      ),
    );
    await Promise.all([this.auth.ready, firstNavigation]);
  }
}
