import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { BusinessPause } from '@shared/business/models/business-pause';
import type { Business } from '@shared/business/models/business.model';
import { OrderPauseRepository } from '../../services/order-pause.repository';
import { OrderPauseCard } from './order-pause-card';

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('BusinessPause', () => {
  it('is paused until a future time or indefinitely', () => {
    const now = Date.parse('2026-10-26T12:00:00Z');
    expect(BusinessPause.isPaused('2026-10-26T12:30:00Z', now)).toBe(true);
    expect(BusinessPause.isPaused('2026-10-26T11:30:00Z', now)).toBe(false);
    expect(BusinessPause.isPaused('infinity', now)).toBe(true);
    expect(BusinessPause.isPaused(null, now)).toBe(false);
  });
});

describe('OrderPauseCard', () => {
  it('pauses for the chosen minutes, then offers to resume', async () => {
    const repo = { set: vi.fn().mockResolvedValueOnce({ data: '2999-01-01T00:30:00Z', errorKey: null }) };
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [{ provide: OrderPauseRepository, useValue: repo }],
    });
    const fixture = TestBed.createComponent(OrderPauseCard);
    fixture.componentRef.setInput('business', { id: 'b1', orders_paused_until: null } as Business);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('button')).toHaveLength(5);
    el.querySelectorAll('button')[1].click();
    await flush();
    fixture.detectChanges();
    expect(repo.set).toHaveBeenCalledWith('b1', 30);
    expect(el.textContent).toContain('owner.pause.pausedUntil');
    repo.set.mockResolvedValueOnce({ data: null, errorKey: null });
    el.querySelector('button')!.click();
    await flush();
    fixture.detectChanges();
    expect(repo.set).toHaveBeenLastCalledWith('b1', 0);
    expect(el.textContent).toContain('owner.pause.intro');
  });
});
