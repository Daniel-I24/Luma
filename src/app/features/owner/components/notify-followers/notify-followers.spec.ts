import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '@design-system';
import { PromotionWriteRepository } from '@shared/business/data/promotion-write.repository';
import type { Promotion } from '@shared/business/models/business.model';
import { NotifyFollowers } from './notify-followers';

const promo = { id: 'p1', notified_at: null } as Promotion;

describe('NotifyFollowers', () => {
  const repo = { notifyFollowers: vi.fn() };
  const toast = { show: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [NotifyFollowers, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [
        { provide: PromotionWriteRepository, useValue: repo },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  const render = (promotion: Promotion) => {
    const fixture = TestBed.createComponent(NotifyFollowers);
    fixture.componentRef.setInput('promotion', promotion);
    fixture.detectChanges();
    return fixture;
  };

  it('tells the followers once and then says it was sent', async () => {
    repo.notifyFollowers.mockResolvedValue({ data: 3, errorKey: null });
    const fixture = render(promo);
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(repo.notifyFollowers).toHaveBeenCalledWith('p1');
    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ messageKey: 'businessPanel.notify.done', params: { count: 3 } }));
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('shows the reason when the database refuses', async () => {
    repo.notifyFollowers.mockResolvedValue({ data: null, errorKey: 'businessPanel.notify.limit' });
    const fixture = render(promo);
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(toast.show).toHaveBeenCalledWith({ messageKey: 'businessPanel.notify.limit', tone: 'error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
  });

  it('an already announced promotion has no button', () => {
    expect(render({ ...promo, notified_at: '2026-10-19T10:00:00Z' }).nativeElement.querySelector('button')).toBeNull();
  });
});
