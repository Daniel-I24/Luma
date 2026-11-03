import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { PHONE_VERIFICATION_ENABLED } from '@core/config/build-flags';
import { SupabaseService } from '@core/supabase/supabase.service';
import { Phone } from '../phone';
import { PhoneVerificationService } from '../phone-verification.service';
import { PhoneVerification } from './phone-verification';

const mobile = Phone.parse('3001234567');

function setup(enabled: boolean) {
  const auth = {
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
  };
  const rpc = vi.fn().mockResolvedValue({ error: null });
  TestBed.configureTestingModule({
    imports: [PhoneVerification, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
    providers: [
      { provide: PHONE_VERIFICATION_ENABLED, useValue: enabled },
      { provide: SupabaseService, useValue: { client: { auth, rpc } } },
    ],
  });
  return { auth, rpc };
}

describe('PhoneVerification', () => {
  it('renders nothing while the feature is off', () => {
    setup(false);
    const fixture = TestBed.createComponent(PhoneVerification);
    fixture.componentRef.setInput('phone', mobile);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('sends the SMS code, checks it as a phone change and copies the verified number', async () => {
    const { auth, rpc } = setup(true);
    const service = TestBed.inject(PhoneVerificationService);
    expect(await service.sendCode(mobile!)).toBeNull();
    expect(auth.updateUser).toHaveBeenCalledWith({ phone: '+573001234567' });
    expect(await service.confirm(mobile!, ' 123456 ')).toBeNull();
    expect(auth.verifyOtp).toHaveBeenCalledWith({ phone: '+573001234567', token: '123456', type: 'phone_change' });
    expect(rpc).toHaveBeenCalledWith('sync_verified_phone');
  });

  it('answers translated errors for a wrong code or too many attempts', async () => {
    const { auth } = setup(true);
    const service = TestBed.inject(PhoneVerificationService);
    auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    expect(await service.confirm(mobile!, '000000')).toBe('auth.errors.codeInvalid');
    auth.updateUser.mockResolvedValue({ error: { message: 'Too many requests' } });
    expect(await service.sendCode(mobile!)).toBe('auth.errors.tooManyRequests');
  });
});
