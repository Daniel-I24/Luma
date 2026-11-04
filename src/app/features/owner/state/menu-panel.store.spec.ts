import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { MenuWriteRepository } from '@shared/business/data/menu-write.repository';
import type { MenuItem } from '@shared/business/models/menu.model';
import { BusinessImageRepository } from '@shared/media/business-image.repository';
import { MenuPanelStore } from './menu-panel.store';
import { at } from '../../../../testing/at';

const item = (id: string, sort_order: number, section: string | null = 'Bebidas'): MenuItem =>
  ({ id, business_id: 'b1', name: id, description: null, price_cop: 5000, section, sort_order, is_available: true, image_url: null }) as MenuItem;

describe('MenuPanelStore: inline edits and order without a form', () => {
  const writer = { update: vi.fn(), create: vi.fn(), setAvailable: vi.fn(), remove: vi.fn() };
  const reader = { getMenu: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    writer.update.mockImplementation((id: string, input: object) => Promise.resolve({ data: { id, business_id: 'b1', ...input }, errorKey: null }));
    TestBed.configureTestingModule({
      providers: [
        MenuPanelStore,
        { provide: MenuWriteRepository, useValue: writer },
        { provide: MenuRepository, useValue: reader },
        { provide: BusinessImageRepository, useValue: { remove: vi.fn() } },
      ],
    });
  });

  async function store(items: MenuItem[]) {
    reader.getMenu.mockResolvedValue({ data: items, errorKey: null });
    const menu = TestBed.inject(MenuPanelStore);
    await menu.load('b1');
    return menu;
  }
  const names = (menu: MenuPanelStore, section = 0) => menu.sections()[section]?.items.map((i) => i.id);

  it('changes a price in place, keeping every other field', async () => {
    const menu = await store([item('jugo', 0)]);
    await menu.patch(at(at(menu.sections(), 0).items, 0), { price_cop: 6500 });

    expect(writer.update).toHaveBeenCalledWith('jugo', expect.objectContaining({ price_cop: 6500, name: 'jugo', section: 'Bebidas', sort_order: 0 }));
    expect(menu.sections()[0]?.items[0]?.price_cop).toBe(6500);
  });

  it('moves a product down and up inside its section, writing only what changed', async () => {
    const menu = await store([item('a', 0), item('b', 1), item('c', 2), item('x', 3, 'Postres')]);
    await menu.move('a', 'b');
    expect(names(menu)).toEqual(['b', 'a', 'c']);
    expect(writer.update).toHaveBeenCalledTimes(2);

    await menu.move('c', 'b');
    expect(names(menu)).toEqual(['c', 'b', 'a']);
    expect(names(menu, 1)).toEqual(['x']);
  });

  it('a drag to the first place of the section; equal old values become an order', async () => {
    const menu = await store([item('a', 0), item('b', 0), item('c', 0)]);
    await menu.move('c', 'a');

    expect(names(menu)).toEqual(['c', 'a', 'b']);
  });

  it('never moves across sections, and a refused write is reported', async () => {
    const menu = await store([item('a', 0), item('x', 1, 'Postres')]);
    expect(await menu.move('a', 'x')).toBe(false);

    writer.update.mockResolvedValue({ data: null, errorKey: 'businessPanel.errors.saveFailed' });
    const other = item('b', 1);
    reader.getMenu.mockResolvedValue({ data: [item('a', 0), other], errorKey: null });
    await menu.load('b1');
    expect(await menu.move('a', 'b')).toBe(false);
    expect(menu.errorKey()).toBe('businessPanel.errors.saveFailed');
  });

  it('a new product goes after the last one', async () => {
    const menu = await store([item('a', 4), item('b', 9)]);
    expect(menu.nextOrder()).toBe(10);
  });
});
