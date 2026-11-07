import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { PushHealthRepository, type PushHealth } from '../../services/push-health.repository';
import { PushServerStatus } from './push-server-status';

const HEALTH: PushHealth = {
  status: 200, body: '{"sent":1,"failed":0}', at: '2026-11-07T16:03:00Z', error: null, tokens: 4, unsent: 1, retrying: 2,
};

async function render(health: PushHealth | null): Promise<string> {
  await TestBed.configureTestingModule({
    imports: [PushServerStatus, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
    providers: [{ provide: PushHealthRepository, useValue: { read: () => Promise.resolve(health) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(PushServerStatus);
  await fixture.componentInstance.ngOnInit();
  fixture.detectChanges();
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('PushServerStatus', () => {
  it('shows the HTTP code, the Colombian time and the answer', async () => {
    const text = await render(HEALTH);
    expect(text).toContain('200');
    expect(text).toContain('11:03');
    expect(text).toContain('"sent":1');
  });

  it('shows the network error instead of the body', async () => {
    const text = await render({ ...HEALTH, status: null, body: null, error: 'Timeout was reached' });
    expect(text).toContain('Timeout was reached');
  });

  it('says so when the status cannot be read', async () => {
    const text = await render(null);
    expect(text).toContain('admin.technical.push.unknown');
    expect(text).not.toContain('200');
  });
});
