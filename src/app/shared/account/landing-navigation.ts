import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorLog } from '@core/errors/error-log';
import { ACCOUNT_ERROR_PATH } from './account-type';
import { SessionProfileStore } from './session-profile.store';

/**
 * LandingNavigation — the step right after signing in: to the home of the
 * account. It can fail (a screen that does not download, a profile read that
 * throws); then the user lands on the account error screen with "Reintentar"
 * instead of staying on the login form with a session.
 */
@Injectable({ providedIn: 'root' })
export class LandingNavigation {
  private readonly router = inject(Router);
  private readonly account = inject(SessionProfileStore);
  private readonly log = inject(ErrorLog);

  /** Goes to the home of the signed-in account; never rejects. */
  public async goHome(): Promise<boolean> {
    try {
      return await this.router.navigateByUrl(await this.account.landingPath());
    } catch (error) {
      this.log.record(error, 'auth');
      return this.router.navigateByUrl(ACCOUNT_ERROR_PATH).catch((fallback: unknown) => {
        this.log.record(fallback, 'auth');
        return false;
      });
    }
  }
}
