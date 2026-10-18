import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '@design-system/toast/toast.service';
import { ReportRepository } from '@shared/business/verification/report.repository';
import { ReportSheet } from './report-sheet';

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('ReportSheet', () => {
  const repo = { create: vi.fn() };
  const toasts = { show: vi.fn() };

  beforeEach(() => vi.clearAllMocks());

  function render() {
    TestBed.configureTestingModule({
      imports: [
        ReportSheet,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        { provide: ReportRepository, useValue: repo },
        { provide: ToastService, useValue: toasts },
      ],
    });
    const fixture = TestBed.createComponent(ReportSheet);
    fixture.componentRef.setInput('businessId', 'b1');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('app-luma-button button')!.click();
    fixture.detectChanges();
    const send = async () => {
      const buttons = root.querySelectorAll<HTMLButtonElement>('app-luma-button button');
      buttons[buttons.length - 1].click();
      await flush();
      fixture.detectChanges();
    };
    const pick = (reason: string) => {
      const input = root.querySelector<HTMLInputElement>('input[value="' + reason + '"]')!;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { root, send, pick };
  }

  it('needs a reason, then sends it and thanks the user', async () => {
    repo.create.mockResolvedValue({ data: true, errorKey: null });
    const { send, pick } = render();

    await send();
    expect(repo.create).not.toHaveBeenCalled();

    pick('not_exists');
    await send();
    expect(repo.create).toHaveBeenCalledWith('b1', 'not_exists', '');
    expect(toasts.show).toHaveBeenCalledWith({ messageKey: 'reports.sent', tone: 'success' });
  });

  it('shows the repository error', async () => {
    repo.create.mockResolvedValue({ data: null, errorKey: 'reports.errors.alreadyReported' });
    const { root, send, pick } = render();

    pick('false_info');
    await send();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'reports.errors.alreadyReported',
    );
  });
});
