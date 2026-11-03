import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromotionInput } from '@shared/business/data/business-write.schemas';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { PromotionWriteRepository } from '@shared/business/data/promotion-write.repository';
import { BusinessImageRepository } from '@shared/media/business-image.repository';
import { PromotionsPanelStore } from './promotions-panel.store';

const input = {
  title: '2x1 en hamburguesas',
  description: null,
  starts_at: '2026-11-01T12:00:00.000Z',
  ends_at: '2026-11-08T12:00:00.000Z',
  image_url: null,
  menu_item_id: null,
  discount_percent: null,
} as PromotionInput;

describe('PromotionsPanelStore: creating a promotion always reports the outcome', () => {
  const repo = { create: vi.fn(), update: vi.fn(), listForOwner: vi.fn(), end: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        PromotionsPanelStore,
        { provide: PromotionWriteRepository, useValue: repo },
        { provide: BusinessImageRepository, useValue: { remove: vi.fn() } },
        { provide: MenuRepository, useValue: { getMenu: vi.fn() } },
      ],
    });
  });

  it('adds the saved promotion to the list', async () => {
    repo.create.mockResolvedValue({ data: { id: 'p1', ...input, is_active: true }, errorKey: null });
    const store = TestBed.inject(PromotionsPanelStore);

    expect(await store.save('b1', null, input)).toBe(true);
    expect(store.promotions().map((p) => p.id)).toEqual(['p1']);
    expect(store.errorKey()).toBeNull();
  });

  it('a refused save keeps its message', async () => {
    repo.create.mockResolvedValue({ data: null, errorKey: 'businessPanel.errors.saveFailed' });
    const store = TestBed.inject(PromotionsPanelStore);

    expect(await store.save('b1', null, input)).toBe(false);
    expect(store.errorKey()).toBe('businessPanel.errors.saveFailed');
  });

  it('an unexpected failure is never silent', async () => {
    repo.create.mockRejectedValue(new Error('network'));
    const store = TestBed.inject(PromotionsPanelStore);

    expect(await store.save('b1', null, input)).toBe(false);
    expect(store.errorKey()).toBe('businessPanel.errors.saveFailed');
    expect(store.busy()).toBe(false);
  });
});
