import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { OrderRepository } from '@shared/orders/order.repository';

/** Test helpers shared by the orders list and order detail specs. */
export class OrdersTesting {
  /** The repository double every spec configures. */
  public static readonly repo = { list: vi.fn(), getById: vi.fn(), cancel: vi.fn() };

  /** One order of business b1 (or of a deleted business). */
  public static order(status: string, deleted = false) {
    return {
      id: 'o1',
      business_id: deleted ? null : 'b1',
      business_name: 'Fritanga Don Segundo',
      business_address: 'Calle 19',
      status,
      pickup_at: null,
      total_cop: 14000,
      notes: null,
      created_at: '2026-10-17T12:00:00.000Z',
      business: deleted ? null : { id: 'b1', latitude: 1.21, longitude: -77.28 },
      items: [{ id: 'i1', menu_item_id: 'm1', name: 'Fritanga', unit_price_cop: 7000, quantity: 2 }],
    };
  }

  /** Lets pending promises settle. */
  public static flush(): Promise<unknown> {
    return new Promise((resolve) => setTimeout(resolve));
  }

  /** TestBed with the translations, the repository double and the route of order o1. */
  public static configure(): void {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            es: {
              orders: {
                unknownBusiness: 'Negocio no disponible',
                detail: { cancel: 'Cancelar pedido' },
              },
            },
          },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: OrderRepository, useValue: OrdersTesting.repo },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'o1' })) } },
      ],
    });
  }
}
