import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessImageRepository } from '@shared/media/business-image.repository';
import { ImageField } from './image-field';

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('ImageField', () => {
  const images = { upload: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        ImageField,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [{ provide: BusinessImageRepository, useValue: images }],
    });
  });

  function render(url: string | null = null) {
    const fixture = TestBed.createComponent(ImageField);
    for (const [name, value] of Object.entries({
      fieldId: 'logo',
      label: 'Logo',
      alt: 'Logo de Fritanga',
      businessId: 'b1',
      kind: 'logo',
      url,
    })) {
      fixture.componentRef.setInput(name, value);
    }
    const changes: (string | null)[] = [];
    fixture.componentInstance.changed.subscribe((value) => changes.push(value));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const pickFile = async (file: File) => {
      const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      await flush();
      fixture.detectChanges();
    };
    return { fixture, el, changes, pickFile };
  }

  it('only offers the accepted types and describes the button with the hint', () => {
    const { el } = render();

    expect(el.querySelector('input[type="file"]')?.getAttribute('accept')).toBe(
      'image/jpeg,image/png,image/webp',
    );
    expect(el.querySelector('#logo')?.getAttribute('aria-describedby')).toBe('logo-hint');
  });

  it('uploads the picked file to the business folder and emits its URL', async () => {
    images.upload.mockResolvedValue({ data: 'https://x.test/b1/logo/n.webp', errorKey: null });
    const { el, changes, pickFile } = render();
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

    await pickFile(file);

    expect(images.upload).toHaveBeenCalledWith('b1', 'logo', file);
    expect(changes).toEqual(['https://x.test/b1/logo/n.webp']);
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('Logo de Fritanga');
  });

  it('shows the upload error and keeps the current picture', async () => {
    images.upload.mockResolvedValue({ data: null, errorKey: 'media.errors.type' });
    const { el, changes, pickFile } = render('https://x.test/old.webp');

    await pickFile(new File(['x'], 'a.gif', { type: 'image/gif' }));

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('media.errors.type');
    expect(changes).toEqual([]);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://x.test/old.webp');
  });

  it('removes the picture', () => {
    const { fixture, el, changes } = render('https://x.test/old.webp');

    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('media.remove'))!
      .click();
    fixture.detectChanges();

    expect(changes).toEqual([null]);
    expect(el.querySelector('img')).toBeNull();
  });
});
