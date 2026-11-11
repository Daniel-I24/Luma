import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { Residence } from '../residence';
import { ResidenceCatalog } from '../residence-catalog';
import { ResidencePicker } from './residence-picker';
import { pickOption } from '../../../../testing/select.harness';

const flush = () => new Promise((resolve) => setTimeout(resolve));
const pasto = { code: '52001', name: 'Pasto', departmentCode: '52', latitude: 1.21, longitude: -77.28 };

describe('ResidencePicker', () => {
  async function render() {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [{
        provide: ResidenceCatalog,
        useValue: {
          load: vi.fn().mockResolvedValue(true),
          departments: () => [{ code: '52', name: 'Nariño' }],
          department: () => ({ code: '52', name: 'Nariño' }),
          municipality: () => pasto,
          search: vi.fn(() => [pasto]),
        },
      }],
    });
    const fixture = TestBed.createComponent(ResidencePicker);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('department, then municipality, then neighbourhood make a complete residence', async () => {
    const { fixture, el } = await render();
    expect(fixture.componentInstance.value()).toBeNull();
    pickOption(fixture, 'residence-department', '52');
    const option = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Pasto'))!;
    option.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toEqual(Residence.of('Nariño', 'Pasto', '52001'));
    const neighborhood = el.querySelector<HTMLInputElement>('#residence-neighborhood')!;
    neighborhood.value = 'Las Cuadras';
    neighborhood.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()?.neighborhood).toBe('Las Cuadras');
  });
});
