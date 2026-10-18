import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { VerificationRepository } from '@shared/business/verification/verification.repository';
import { BusinessVerificationPage } from './business-verification.page';

describe('BusinessVerificationPage', () => {
  const owned = { getMine: vi.fn() };
  const repo = {
    getLegal: vi.fn(),
    listDocs: vi.fn(),
    saveLegal: vi.fn(),
    uploadDoc: vi.fn(),
    deleteDoc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getLegal.mockResolvedValue({ data: null, errorKey: null });
    repo.listDocs.mockResolvedValue({
      data: [
        { id: 'd1', business_id: 'b1', kind: 'rut', storage_path: 'b1/rut/x.pdf', created_at: '' },
      ],
      errorKey: null,
    });
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'b1' })) } },
        { provide: OwnedBusinessRepository, useValue: owned },
        { provide: VerificationRepository, useValue: repo },
      ],
    });
  });

  async function render(status: string) {
    owned.getMine.mockResolvedValue({
      data: { id: 'b1', verification_status: status },
      errorKey: null,
    });
    const fixture = TestBed.createComponent(BusinessVerificationPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.textContent).toContain('x.pdf');
    });
    return { fixture, el };
  }

  it('lets a draft save its legal data only with a valid NIT', async () => {
    repo.saveLegal.mockResolvedValue({ data: true, errorKey: null });
    const { fixture, el } = await render('draft');
    const type = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    type('legal-tax-id', '800197268-5');
    type('legal-name', 'Fritanga SAS');
    type('legal-rep', 'Ana Pérez');
    const form = el.querySelector('form')!;

    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(el.textContent).toContain('verification.validation.nit');
    expect(repo.saveLegal).not.toHaveBeenCalled();

    type('legal-tax-id', '800.197.268-4');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() =>
      expect(repo.saveLegal).toHaveBeenCalledWith(
        'b1',
        '800.197.268-4',
        'Fritanga SAS',
        'Ana Pérez',
      ),
    );
  });

  it('is read-only while under review: no uploads, deletions or saving', async () => {
    const { el } = await render('pending');

    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      'owner.verificationPage.locked',
    );
    expect(el.querySelector('input[type="file"]')).toBeNull();
    expect(el.querySelector('button[aria-label="owner.verificationPage.deleteDoc"]')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('#legal-tax-id')!.disabled).toBe(true);
  });
});
