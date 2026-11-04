import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { AvatarRepository } from '@shared/account/avatar.repository';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { Residence } from '@shared/geo/residence';
import { type PendingDetails, SignupCompletion } from './signup-completion';

const residence = Residence.of('Nariño', 'Pasto', '52001', 'Centro');
const details = (over: Partial<PendingDetails> = {}): PendingDetails => ({
  fullName: '  Ana Prueba ',
  phone: '300 123 4567',
  residence,
  avatar: null,
  avatarConsent: false,
  ...over,
});

describe('SignupCompletion', () => {
  const saveDetails = vi.fn();
  const upload = vi.fn();
  const user = signal<{ id: string } | null>({ id: 'u1' });

  beforeEach(() => {
    saveDetails.mockReset().mockResolvedValue(null);
    upload.mockReset().mockResolvedValue({ data: true, errorKey: null });
    user.set({ id: 'u1' });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: SessionProfileStore, useValue: { whenLoaded: () => Promise.resolve(), saveDetails } },
        { provide: AvatarRepository, useValue: { upload } },
      ],
    });
  });

  it('saves the held name, mobile and residence once the code gave a session, then forgets them', async () => {
    const completion = TestBed.inject(SignupCompletion);
    completion.hold(details());
    expect(await completion.complete()).toEqual([]);
    expect(saveDetails).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Ana Prueba', residence }),
    );
    expect(saveDetails.mock.calls[0]?.[0].phone.e164).toBe('+573001234567');
    expect(await completion.complete()).toEqual([]);
    expect(saveDetails).toHaveBeenCalledTimes(1);
  });

  it('uploads the optional photo with its consent and reports the parts that failed', async () => {
    saveDetails.mockResolvedValue('profile.errors.save');
    upload.mockResolvedValue({ data: null, errorKey: 'media.errors.upload' });
    const avatar = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    const completion = TestBed.inject(SignupCompletion);
    completion.hold(details({ avatar, avatarConsent: true }));
    expect(await completion.complete()).toEqual(['profile.errors.save', 'media.errors.upload']);
    expect(upload).toHaveBeenCalledWith('u1', avatar, true);
  });

  it('does nothing without held details or without a session', async () => {
    const completion = TestBed.inject(SignupCompletion);
    expect(await completion.complete()).toEqual([]);
    user.set(null);
    completion.hold(details());
    expect(await completion.complete()).toEqual([]);
    expect(saveDetails).not.toHaveBeenCalled();
  });
});
