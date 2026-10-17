import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollWhileVisible } from './poll-while-visible';

const refresh = vi.fn();

@Component({ template: '' })
class Poller {
  constructor() {
    pollWhileVisible(refresh, 15_000);
  }
}

describe('pollWhileVisible', () => {
  let visibility: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const setVisibility = (state: DocumentVisibilityState) => {
    visibility = state;
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('refreshes every interval while visible', () => {
    TestBed.createComponent(Poller);

    vi.advanceTimersByTime(45_000);

    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('pauses in the background and refreshes at once when back', () => {
    TestBed.createComponent(Poller);

    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(refresh).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('stops when the component is destroyed', () => {
    const fixture = TestBed.createComponent(Poller);
    fixture.destroy();

    vi.advanceTimersByTime(60_000);
    setVisibility('visible');

    expect(refresh).not.toHaveBeenCalled();
  });
});
