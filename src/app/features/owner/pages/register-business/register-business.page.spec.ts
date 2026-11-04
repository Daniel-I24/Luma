import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { registerBusinessPageHarness } from './register-business.page.harness';

describe('RegisterBusinessPage', () => {
  const h = registerBusinessPageHarness();
  const { repo, render } = h;

  it('shows each error next to its field and focuses the first one', async () => {
    const { el, type, submit } = await render();
    type('register-name', 'Fritanga Don Segundo');

    await submit();

    expect(repo.create).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('register-category');
    const category = el.querySelector('#register-category')!;
    expect(category.getAttribute('aria-invalid')).toBe('true');
    expect(
      el.querySelector(`#${category.getAttribute('aria-describedby')}`)?.textContent,
    ).toContain('businessPanel.validation.category');
    expect(el.textContent).toContain('businessPanel.validation.location');

    type('register-category', 'Bar');
    expect(category.getAttribute('aria-invalid')).toBeNull();
  });

  it('registers the business with the pinned location and opens it', async () => {
    repo.create.mockResolvedValue({ data: 'new-id', errorKey: null });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { type, pinLocation, submit, settled } = await render();
    type('register-name', 'Fritanga Don Segundo');
    type('register-category', 'Restaurante');
    type('register-address', 'Calle 18 # 25-30');
    pinLocation();

    await submit();

    await settled(() => expect(navigate).toHaveBeenCalledWith(['/owner', 'new-id', 'setup']));
    expect(repo.create).toHaveBeenCalledWith({
      name: 'Fritanga Don Segundo',
      category: 'Restaurante',
      phone: null,
      address: 'Calle 18 # 25-30',
      latitude: 1.2136,
      longitude: -77.2811,
      department: null,
      city_dane_code: null,
    });
  });
});
