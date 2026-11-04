import { describe, expect, it, vi } from 'vitest';
import { ownerSummaryPageHarness } from './owner-summary.page.harness';

describe('OwnerSummaryPage: publishing', () => {
  const h = ownerSummaryPageHarness();
  const { owned, menus, render } = h;

  it('offers Publicado / Pausado only once verified', async () => {
    owned.setPublished.mockResolvedValue({ data: true, errorKey: null });
    const { fixture, el, button } = await render({ verification_status: 'approved' });

    expect(el.textContent).toContain('owner.publish.approvedHidden');
    button('owner.publish.publishNow')!.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.textContent).toContain('owner.publish.pause');
    });
    expect(owned.setPublished).toHaveBeenCalledWith('b1', true);
  });

  it('an approved business that is not visible yet says so, lists what is missing and keeps "Publicar ahora" off', async () => {
    menus.getMenu.mockResolvedValue({ data: [{ is_available: false }], errorKey: null });
    const { el, button } = await render({ verification_status: 'approved' });

    expect(el.textContent).toContain('owner.publish.approvedHidden');
    expect(el.textContent).toContain('businessPanel.requirements.availableItem');
    expect(button('owner.publish.publishNow')?.disabled).toBe(true);
  });

  it('a published business does not show the "not visible yet" notice', async () => {
    const { el } = await render({ verification_status: 'approved', is_active: true });

    expect(el.textContent).not.toContain('owner.publish.approvedHidden');
    expect(el.textContent).toContain('owner.publish.pause');
  });

  it('when publishing fails, the reason is shown translated', async () => {
    owned.setPublished.mockResolvedValue({ data: null, errorKey: 'businessPanel.errors.publishRequirements' });
    const { fixture, el, button } = await render({ verification_status: 'approved' });

    button('owner.publish.publishNow')!.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('businessPanel.errors.publishRequirements');
    });
  });
});
