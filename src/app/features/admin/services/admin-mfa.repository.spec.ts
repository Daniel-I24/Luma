import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorLog } from '@core/errors/error-log';
import { SupabaseService } from '@core/supabase/supabase.service';
import { AdminMfaRepository } from './admin-mfa.repository';

describe('AdminMfaRepository', () => {
  const mfa = { listFactors: vi.fn(), unenroll: vi.fn(), enroll: vi.fn(), challengeAndVerify: vi.fn() };
  const noFactors = { data: { all: [], totp: [] }, error: null };
  let repo: AdminMfaRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { auth: { mfa } } } }],
    });
    repo = TestBed.inject(AdminMfaRepository);
  });

  const loggedCode = () => TestBed.inject(ErrorLog).entries()[0]?.message;

  it('listFactors that fails or throws answers a key and keeps the code', async () => {
    mfa.listFactors.mockResolvedValueOnce({ data: null, error: { code: 'mfa_totp_enroll_not_enabled', message: 'x' } });
    expect((await repo.verifiedFactor()).errorKey).toBe('admin.mfa.errors.loadFailed');

    mfa.listFactors.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await repo.verifiedFactor()).errorKey).toBe('admin.mfa.errors.loadFailed');
    expect(loggedCode()).toBe('admin_mfa: network');
  });

  it('an unfinished factor that cannot be removed stops the enrolment with its own message', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { all: [{ id: 'old', factor_type: 'totp', status: 'unverified' }], totp: [] },
      error: null,
    });
    mfa.unenroll.mockResolvedValue({ data: null, error: { message: 'insufficient_aal' } });

    expect((await repo.enroll()).errorKey).toBe('admin.mfa.errors.cleanupFailed');
    expect(mfa.enroll).not.toHaveBeenCalled();
    expect(loggedCode()).toBe('admin_mfa: insufficient_aal');
  });

  it('enroll that throws answers a key', async () => {
    mfa.listFactors.mockResolvedValue(noFactors);
    mfa.enroll.mockRejectedValue(new Error('boom'));
    expect((await repo.enroll()).errorKey).toBe('admin.mfa.errors.enrollFailed');
  });

  it('gives the QR as an encoded image and always keeps the secret', async () => {
    mfa.listFactors.mockResolvedValue(noFactors);
    mfa.enroll.mockResolvedValue({
      data: { id: 'f1', totp: { secret: 'JBSWY3DP', qr_code: 'data:image/svg+xml;utf-8,<svg fill="#000"/>' } },
      error: null,
    });
    const { data } = await repo.enroll();
    expect(data?.secret).toBe('JBSWY3DP');
    expect(data?.qrCode).toBe(`data:image/svg+xml;utf-8,${encodeURIComponent('<svg fill="#000"/>')}`);
  });

  it('without a usable QR the secret is enough', () => {
    expect(AdminMfaRepository.qrImage(undefined)).toBeNull();
    expect(AdminMfaRepository.qrImage('javascript:alert(1)')).toBeNull();
    expect(AdminMfaRepository.qrImage('<svg/>')).toBe(`data:image/svg+xml;utf-8,${encodeURIComponent('<svg/>')}`);
  });
});
