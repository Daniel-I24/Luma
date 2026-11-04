import { describe, expect, it } from 'vitest';
import { registerBusinessPageHarness } from './register-business.page.harness';

describe('RegisterBusinessPage: server errors', () => {
  const h = registerBusinessPageHarness();
  const { repo, render } = h;

  it('keeps the form and shows the server error', async () => {
    repo.create.mockResolvedValue({ data: null, errorKey: 'businessPanel.errors.saveFailed' });
    const { el, type, pinLocation, submit, settled } = await render();
    type('register-name', 'Fritanga');
    type('register-category', 'Bar');
    type('register-address', 'Calle 18 # 25-30');
    pinLocation();

    await submit();

    await settled(() =>
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'businessPanel.errors.saveFailed',
      ),
    );
  });
});
