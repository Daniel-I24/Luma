import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { type TrustStatus, TrustStatusRepository } from '../../services/trust-status.repository';
import { TrustStatusCard } from './trust-status-card';

const flush = () => new Promise((resolve) => setTimeout(resolve));

async function render(status: TrustStatus | null): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
    providers: [{ provide: TrustStatusRepository, useValue: { mine: vi.fn().mockResolvedValue(status) } }],
  });
  const fixture = TestBed.createComponent(TrustStatusCard);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('TrustStatusCard', () => {
  it('a restricted customer sees the strikes, the end date and the reason', async () => {
    const el = await render({ tier: 'restricted', strikes: 3, restrictedUntil: '2026-11-20T10:00:00Z', pickedUp: 0, pickedUpNeeded: 2 });
    expect(el.textContent).toContain('trust.tier.restricted');
    expect(el.textContent).toContain('trust.strikes');
    expect(el.textContent).toContain('trust.until');
    expect(el.textContent).not.toContain('trust.improve');
  });

  it('a new customer sees how to become trusted', async () => {
    const el = await render({ tier: 'new', strikes: 0, restrictedUntil: null, pickedUp: 1, pickedUpNeeded: 1 });
    expect(el.textContent).toContain('trust.improve');
    expect(el.textContent).not.toContain('trust.strikes');
  });

  it('shows nothing when the status cannot be read', async () => {
    expect((await render(null)).textContent?.trim()).toBe('');
  });
});
