import { TestBed } from '@angular/core/testing';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiModes } from '@core/config/ai-mode';
import { SupabaseService } from '@core/supabase/supabase.service';
import { PanelQueryLog } from '@shared/business/diagnostics/panel-query-log';
import { IMAGE_ENCODER } from '@shared/media/image-encoder';
import { MenuScanRepository } from './menu-scan.repository';

const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'menu.jpg', { type: 'image/jpeg' });
const http = (status: number, body: unknown) => new FunctionsHttpError(Response.json(body, { status }));

describe('MenuScanRepository: every failure has its own message', () => {
  const invoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { functions: { invoke } } } },
        { provide: IMAGE_ENCODER, useValue: () => Promise.resolve({ blob: new Blob([new Uint8Array([1, 2, 3])]) }) },
      ],
    });
  });

  const scan = () => TestBed.inject(MenuScanRepository).scan('b1', [photo]);

  it('a build without AI_MODE=remote is in rules mode (the cause of "Luma IA no está disponible")', () => {
    expect(AiModes.built()).toBe('rules');
  });

  it('quota, rate limit, not deployed, no answer and each provider reason', async () => {
    const cases: [unknown, string][] = [
      [http(429, { error: 'quota_exceeded' }), 'owner.menuScan.quota'],
      [http(429, { error: 'rate_limited' }), 'owner.menuScan.rateLimited'],
      [http(404, {}), 'owner.menuScan.errors.notDeployed'],
      [new FunctionsFetchError({}), 'owner.menuScan.errors.noResponse'],
      [http(503, { error: 'ai_unavailable', reason: 'not_configured' }), 'owner.menuScan.errors.notConfigured'],
      [http(503, { error: 'ai_unavailable', reason: 'provider_auth' }), 'owner.menuScan.errors.providerKey'],
      [http(503, { error: 'ai_unavailable', reason: 'provider_model' }), 'owner.menuScan.errors.providerModel'],
      [http(503, { error: 'ai_unavailable', reason: 'provider_rate_limit' }), 'owner.menuScan.errors.providerBusy'],
      [http(503, { error: 'ai_unavailable', reason: 'timeout' }), 'owner.menuScan.errors.slow'],
      [http(503, { error: 'ai_unavailable' }), 'owner.menuScan.unavailable'],
    ];
    for (const [error, key] of cases) {
      invoke.mockResolvedValueOnce({ data: null, error });
      expect((await scan()).errorKey).toBe(key);
    }
  });

  it('"Información técnica" gets the status and codes, never a key or a provider text', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: http(503, { error: 'ai_unavailable', reason: 'provider_auth', detail: 'sk-secret' }) });
    await scan();
    const entry = TestBed.inject(PanelQueryLog).entries()[0];
    expect(entry).toMatchObject({ table: 'extract-menu', filter: '503 ai_unavailable provider_auth', rows: null });
    expect(JSON.stringify(entry)).not.toContain('sk-secret');
  });
});
