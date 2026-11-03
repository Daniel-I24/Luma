import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Residence } from './residence';
import { ResidenceCatalog } from './residence-catalog';

const CATALOG = {
  source: 'test',
  departments: [['52', 'Nariño'], ['76', 'Valle del Cauca']],
  municipalities: [['52001', 'Pasto', 1.21, -77.28], ['52356', 'Ipiales', 0.83, -77.64],
    ['52835', 'San Andrés de Tumaco', 1.81, -78.76], ['76001', 'Cali', 3.45, -76.53]],
};

describe('Residence', () => {
  it('needs department, municipality and a five-digit DANE code', () => {
    const home = Residence.of(' Nariño ', 'Pasto', '52001', '  Las Cuadras ')!;
    expect([home.department, home.city, home.departmentCode, home.neighborhood]).toEqual(['Nariño', 'Pasto', '52', 'Las Cuadras']);
    expect(home.toRow()).toEqual({
      residence_department: 'Nariño', residence_city: 'Pasto', residence_dane_code: '52001', residence_neighborhood: 'Las Cuadras',
    });
    expect(Residence.of('Nariño', 'Pasto', '5200')).toBeNull();
    expect(Residence.of('', 'Pasto', '52001')).toBeNull();
    expect(Residence.of('Nariño', 'Pasto', '52001', '   ')?.neighborhood).toBeNull();
    expect(Residence.of('Nariño', 'Pasto', '52001', 'x'.repeat(80))?.neighborhood?.length).toBe(60);
  });
});

describe('ResidenceCatalog', () => {
  let http: HttpTestingController;
  let catalog: ResidenceCatalog;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    catalog = TestBed.inject(ResidenceCatalog);
  });

  it('loads the bundled asset once and searches without accents, prefix matches first', async () => {
    const first = catalog.load();
    const second = catalog.load();
    http.expectOne('data/dane-municipalities.json').flush(CATALOG);
    expect([await first, await second]).toEqual([true, true]);
    expect(catalog.departments().map((d) => d.name)).toEqual(['Nariño', 'Valle del Cauca']);
    expect(catalog.search('52', 'TUMACO').map((m) => m.name)).toEqual(['San Andrés de Tumaco']);
    expect(catalog.search('52', 'pa').map((m) => m.code)).toEqual(['52001']);
    expect(catalog.search('52', 'a').map((m) => m.code)).toEqual(['52001', '52356', '52835']);
    expect(catalog.search('76', 'pasto')).toEqual([]);
    expect(catalog.municipality('76001')?.latitude).toBe(3.45);
    expect(ResidenceCatalog.searchKey('Nariño ')).toBe('narino');
  });

  it('refuses a malformed asset and lets a later screen retry', async () => {
    const failed = catalog.load();
    http.expectOne('data/dane-municipalities.json').flush({ departments: 'x' });
    expect(await failed).toBe(false);
    const retry = catalog.load();
    http.expectOne('data/dane-municipalities.json').flush(CATALOG);
    expect(await retry).toBe(true);
  });
});
