import { Injectable, inject } from '@angular/core';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { GeolocationService } from './geolocation.service';
import { ResidenceCatalog } from './residence-catalog';

/**
 * ResidenceMapCentre — without the device location, the map starts at the
 * centre of the customer's municipality of residence (DANE catalog) instead
 * of Pasto. Called by the map screen; the catalog loads only then.
 */
@Injectable({ providedIn: 'root' })
export class ResidenceMapCentre {
  private readonly session = inject(SessionProfileStore);
  private readonly catalog = inject(ResidenceCatalog);
  private readonly geo = inject(GeolocationService);

  /** Centres the map on the user's municipality when no location is known. */
  public async apply(): Promise<void> {
    if (this.geo.hasRealLocation()) return;
    await this.session.whenLoaded();
    const code = this.session.profile()?.residence?.daneCode;
    if (!code || !(await this.catalog.load())) return;
    const town = this.catalog.municipality(code);
    if (town) this.geo.useFallback({ lat: town.latitude, lng: town.longitude }, town.name);
  }
}
