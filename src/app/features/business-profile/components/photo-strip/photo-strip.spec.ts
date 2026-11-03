import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { BusinessPhotoRepository } from '@shared/business/data/business-photo.repository';
import { PhotoStrip } from './photo-strip';

async function render(result: unknown) {
  TestBed.configureTestingModule({
    imports: [PhotoStrip, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
    providers: [{ provide: BusinessPhotoRepository, useValue: { list: vi.fn().mockResolvedValue(result) } }],
  });
  const fixture = TestBed.createComponent(PhotoStrip);
  fixture.componentRef.setInput('businessId', 'b1');
  fixture.componentRef.setInput('businessName', 'Café');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PhotoStrip', () => {
  it('shows the photos with their captions', async () => {
    const el = await render({
      data: [{ id: 'p1', path: 'x', url: 'https://x/1.webp', caption: 'Terraza', sortOrder: 0 }],
      errorKey: null,
    });
    expect(el.querySelectorAll('li')).toHaveLength(1);
    expect(el.textContent).toContain('Terraza');
  });

  it('is hidden without photos or when they cannot be read', async () => {
    expect((await render({ data: null, errorKey: 'x' })).querySelector('section')).toBeNull();
  });
});
