import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaSkeleton } from '@design-system';
import { type AndroidRelease, ReleaseRepository } from './release.repository';
import { BYTES_PER_MB } from '@core/config/units';

/**
 * DownloadPage — /download (public): the signed Android APK announced in
 * /version.json, with its size and SHA-256 so it can be checked, and the
 * steps to install it. Without a published APK it says so and links to the
 * web app.
 */
@Component({
  selector: 'app-download-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaSkeleton],
  template: `
    <main
      *transloco="let t"
      class="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 bg-canvas px-4 pt-[calc(var(--inset-top)+var(--spacing-8))] pb-8"
    >
      <h1 class="m-0 text-h2 text-fg">{{ t('download.title') }}</h1>
      <p class="m-0 text-body text-fg-muted">{{ t('download.intro') }}</p>
      @if (loading()) {
        <app-luma-skeleton class="h-24 w-full" shape="rect" />
      } @else if (release()?.apk; as apk) {
        <a
          [href]="apk.url"
          class="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-4 text-body font-semibold text-primary-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >{{ t('download.button', { version: release()!.version, size: megabytes(apk.size) }) }}</a
        >
        <ol class="m-0 flex flex-col gap-2 pl-5 text-body text-fg">
          <li>{{ t('download.steps.download') }}</li>
          <li>{{ t('download.steps.allow') }}</li>
          <li>{{ t('download.steps.install') }}</li>
        </ol>
        <section class="rounded-md border border-border-subtle bg-surface p-3" aria-labelledby="download-check">
          <h2 id="download-check" class="m-0 text-body font-semibold text-fg">{{ t('download.check') }}</h2>
          <p class="m-0 mt-1 text-caption text-fg-muted">{{ t('download.checkHint') }}</p>
          <code class="mt-2 block text-caption break-all text-fg">{{ apk.sha256 }}</code>
        </section>
      } @else {
        <p class="m-0 rounded-md bg-surface-selected p-3 text-body text-fg" role="status">{{ t('download.soon') }}</p>
      }
      <a routerLink="/" class="inline-flex min-h-11 items-center text-body font-semibold text-fg-brand">{{ t('download.web') }}</a>
    </main>
  `,
})
export class DownloadPage implements OnInit {
  private readonly repo = inject(ReleaseRepository);
  protected readonly release = signal<AndroidRelease | null>(null);
  protected readonly loading = signal(true);

  /** Loads the latest published APK. */
  public async ngOnInit(): Promise<void> {
    this.release.set(await this.repo.latest());
    this.loading.set(false);
  }

  protected megabytes(bytes: number): string {
    return (bytes / BYTES_PER_MB).toFixed(1);
  }
}
