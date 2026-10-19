import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState } from '@design-system';

/** NotFoundPage — any unknown address: says so and offers a way out. */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, LumaEmptyState],
  template: `
    <main
      *transloco="let t"
      class="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 bg-canvas px-4"
    >
      <app-luma-empty-state
        icon="compass"
        [heading]="t('notFound.title')"
        [description]="t('notFound.description')"
      >
        <div class="flex flex-col gap-2">
          <a
            routerLink="/"
            class="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-body font-semibold text-primary-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >{{ t('notFound.home') }}</a
          >
          <app-luma-button variant="ghost" (clicked)="back()">{{
            t('common.back')
          }}</app-luma-button>
        </div>
      </app-luma-empty-state>
    </main>
  `,
})
export class NotFoundPage {
  private readonly location = inject(Location);

  protected back(): void {
    this.location.back();
  }
}
