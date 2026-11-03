import { inject } from '@angular/core';
import { type CanActivateFn, Router, type Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { PaymentReturn } from './payment-return';

/**
 * /payments/return?order=…&id=… — where Wompi sends a payment started on the
 * web (a browser cannot open luma://): the same as the link, then the order.
 * Loaded only then, so the first screen does not carry it.
 */
export const webReturnGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const link = PaymentReturn.parse(`${PaymentReturn.PREFIX}?${new URLSearchParams({
    order: route.queryParamMap.get('order') ?? '', id: route.queryParamMap.get('id') ?? '',
  }).toString()}`);
  if (!link) return router.createUrlTree(['/orders']);
  await inject(PaymentReturn).record(link);
  return router.createUrlTree(['/orders', link.orderId]);
};

export const paymentReturnRoutes: Routes = [{ path: '', canActivate: [authGuard, webReturnGuard], children: [] }];
