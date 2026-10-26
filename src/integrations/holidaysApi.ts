import { parseOpenHolidays } from '../domain/holidays';
import type { HolidayData } from '../domain/types';
import { httpRequest } from './http';

/** Loads Brandenburg school holidays for this and the next two years from OpenHolidays. */
export async function fetchBrandenburgHolidays(now = new Date()): Promise<HolidayData | null> {
  const from = `${now.getFullYear() - 1}-08-01`;
  const to = `${now.getFullYear() + 2}-12-31`;
  const url =
    'https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-BB&languageIsoCode=DE' +
    `&validFrom=${from}&validTo=${to}`;
  const json = await httpRequest<unknown>({ url, headers: { Accept: 'application/json' } });
  const periods = parseOpenHolidays(json);
  if (periods.length < 3) return null;
  return { periods, source: 'online', updatedAt: now.toISOString() };
}
