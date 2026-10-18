import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, ok } from '../../../../testing/fake-supabase';
import type { FakeResponse } from '../../../../testing/fake-supabase';
import { AdminRepository, SIGNED_URL_SECONDS } from './admin.repository';
import { ReportRepository } from './report.repository';
import { VerificationRepository } from './verification.repository';
import type { VerificationDoc } from './verification.model';

const bucket = {
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
};

function setup(responses: Record<string, FakeResponse> = {}) {
  const fake = createFakeSupabase(responses);
  const client = { ...fake.client, storage: { from: vi.fn(() => bucket) } };
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: { client } }],
  });
  return {
    verification: TestBed.inject(VerificationRepository),
    admin: TestBed.inject(AdminRepository),
    reports: TestBed.inject(ReportRepository),
    fake,
  };
}

const doc: VerificationDoc = {
  id: 'd1',
  business_id: 'b1',
  kind: 'rut',
  storage_path: 'b1/rut/x.pdf',
  created_at: '',
};

describe('verification repositories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checks the NIT check digit before saving and stores the normalised form', async () => {
    const { verification, fake } = setup({ business_legal: ok(null) });

    expect((await verification.saveLegal('b1', '800197268-5', 'SAS', 'Ana')).errorKey).toBe(
      'verification.validation.nit',
    );
    expect(await verification.saveLegal('b1', '800.197.268-4', ' Fritanga SAS ', 'Ana')).toEqual({
      data: true,
      errorKey: null,
    });
    const insert = fake.queries.find((q) => q.call('insert'))?.call('insert')?.[0];
    expect(insert).toEqual({
      business_id: 'b1',
      tax_id: '800197268-4',
      legal_name: 'Fritanga SAS',
      legal_rep_name: 'Ana',
    });
  });

  it('uploads documents to {business}/{kind}/{uuid}.{ext} and refuses other types or sizes', async () => {
    bucket.upload.mockResolvedValue({ error: null });
    const { verification, fake } = setup();
    const pdf = new File(['%PDF'], 'rut.pdf', { type: 'application/pdf' });

    expect((await verification.uploadDoc('b1', 'rut', pdf)).data).toBe(true);
    expect(bucket.upload.mock.calls[0][0]).toMatch(/^b1\/rut\/[0-9a-f-]{36}\.pdf$/);
    expect(fake.queries[0].call('insert')?.[0]).toEqual(
      expect.objectContaining({ business_id: 'b1', kind: 'rut' }),
    );
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' });
    expect((await verification.uploadDoc('b1', 'rut', gif)).errorKey).toBe(
      'verification.errors.docType',
    );
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    expect((await verification.uploadDoc('b1', 'rut', big)).errorKey).toBe(
      'verification.errors.docSize',
    );
  });

  it('removes the uploaded file when its row cannot be saved', async () => {
    bucket.upload.mockResolvedValue({ error: null });
    bucket.remove.mockResolvedValue({ error: null });
    const { verification } = setup({
      business_verification_docs: { data: null, error: { message: 'rls', code: '42501' } },
    });

    await verification.uploadDoc('b1', 'facade', new File(['x'], 'f.jpg', { type: 'image/jpeg' }));

    expect(bucket.remove).toHaveBeenCalledOnce();
  });

  it('reads the submit result and validates its codes', async () => {
    const { verification } = setup({
      'rpc:submit_business_for_review': ok({ ok: false, missing: ['legal'] }),
    });

    expect((await verification.submit('b1')).data).toEqual({ ok: false, missing: ['legal'] });
  });

  it('signs document URLs for one minute and maps review errors', async () => {
    bucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed' },
      error: null,
    });
    const { admin } = setup({
      'rpc:review_business': { data: null, error: { message: 'note_required' } },
    });

    expect((await admin.signedDocUrl(doc)).data).toBe('https://signed');
    expect(bucket.createSignedUrl).toHaveBeenCalledWith('b1/rut/x.pdf', SIGNED_URL_SECONDS);
    expect((await admin.review('b1', 'rejected', null)).errorKey).toBe('admin.errors.noteRequired');
  });

  it('deletes the files first, then their rows', async () => {
    bucket.remove.mockResolvedValue({ error: null });
    const { admin, fake } = setup();

    expect((await admin.deleteDocs([doc])).data).toBe(true);
    expect(bucket.remove).toHaveBeenCalledWith(['b1/rut/x.pdf']);
    expect(fake.queries[0].call('in')).toEqual(['id', ['d1']]);
  });

  it('turns a second open report into a friendly message', async () => {
    const { reports } = setup({
      reports: { data: null, error: { message: 'dup', code: '23505' } },
    });

    expect((await reports.create('b1', 'false_info', null)).errorKey).toBe(
      'reports.errors.alreadyReported',
    );
  });
});
