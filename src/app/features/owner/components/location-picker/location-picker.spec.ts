import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeoCoords } from '@shared/geo/geolocation.service';
import { PlaceSearchRepository } from '@shared/geo/place-search.repository';
import { LocationPicker } from './location-picker';
import { type PickerMap, PickerMapFactory } from './picker-map';

const PASTO = { lat: 1.2136, lng: -77.2811 };

/** A map driven by the test: `drag` moves the centre like a finger would. */
function fakeMap() {
  let centre: GeoCoords = PASTO;
  let start = (): void => undefined;
  let end: (centre: GeoCoords) => void = () => undefined;
  const map: PickerMap = {
    centre: () => centre,
    moveTo: vi.fn((point: GeoCoords) => void (centre = point)),
    onMove: (s, e) => {
      start = s;
      end = e;
    },
    remove: vi.fn(),
  };
  return { map, dragStart: () => start(), drop: (to: GeoCoords) => end((centre = to)) };
}

@Component({
  imports: [LocationPicker],
  template: `<app-location-picker pickerId="pick" [centre]="centre" [others]="others" [(position)]="position" />`,
})
class Host {
  public centre = PASTO;
  public others: GeoCoords[] = [{ lat: 1.2005, lng: -77.2602 }];
  public position = signal<GeoCoords | null>(null);
}

describe('LocationPicker', () => {
  const places = { search: vi.fn(), reverse: vi.fn() };
  let drive: ReturnType<typeof fakeMap>;

  beforeEach(() => {
    drive = fakeMap();
    places.search.mockResolvedValue({
      // The simulated geocoder: one candidate in Pasto, one "Centro" of another municipality.
      places: [
        { label: 'Jamondino, Pasto', kind: 'neighbourhood', lat: 1.2005, lng: -77.2602 },
        { label: 'Centro, Ipiales', kind: 'neighbourhood', lat: 0.8301, lng: -77.6444 },
      ],
      attribution: null, errorKey: null,
    });
    TestBed.configureTestingModule({
      imports: [Host, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [
        { provide: PickerMapFactory, useValue: { create: () => drive.map } },
        { provide: PlaceSearchRepository, useValue: places },
      ],
    });
  });

  const render = async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const pin = () => el.querySelector('.picker-pin')!;
    const confirm = () => {
      el.querySelector<HTMLButtonElement>('#pick')!.click();
      fixture.detectChanges();
    };
    return { fixture, el, pin, confirm };
  };

  it('the pin lifts while the map moves and drops at the new centre; only "Confirmar" sets the point', async () => {
    const { fixture, el, pin, confirm } = await render();
    drive.dragStart();
    fixture.detectChanges();
    expect(pin().classList).toContain('picker-pin--lifted');
    drive.drop({ lat: 1.2201, lng: -77.2755 });
    fixture.detectChanges();
    expect(pin().classList).not.toContain('picker-pin--lifted');
    expect(fixture.componentInstance.position()).toBeNull();
    expect(el.textContent).toContain('location.unconfirmed');

    confirm();
    expect(fixture.componentInstance.position()).toEqual({ lat: 1.2201, lng: -77.2755 });
    expect(el.textContent).toContain('location.confirmed');
  });

  it('search candidates outside the municipality are dropped; choosing one moves the map but does not confirm', async () => {
    const { fixture, el, confirm } = await render();
    const input = el.querySelector<HTMLInputElement>('#pick-location-search')!;
    input.value = 'Jamondino';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(places.search).toHaveBeenCalledWith('Jamondino', PASTO, { ...PASTO, radiusKm: 15 });
    const options = [...el.querySelectorAll('ul button')].map((b) => b.textContent ?? '');
    expect(options.some((o) => o.includes('Jamondino'))).toBe(true);
    expect(options.some((o) => o.includes('Ipiales'))).toBe(false);

    (el.querySelector('ul button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(drive.map.moveTo).toHaveBeenCalledWith(expect.objectContaining({ lat: 1.2005, lng: -77.2602 }));
    expect(fixture.componentInstance.position()).toBeNull();

    // Confirmed on top of another business of the owner: a warning, not a block.
    confirm();
    expect(el.textContent).toContain('location.warnings.sameAsOtherBusiness');
  });
});
