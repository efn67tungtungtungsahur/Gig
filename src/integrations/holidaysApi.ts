import { addDays, dayKey } from '../lib/dates';
import { parseOpenHolidays } from '../domain/holidays';
import type { HolidayData } from '../domain/types';
import { httpRequest } from './http';

/** Loads Brandenburg school holidays for the next two years from OpenHolidays. */
export async function fetchBrandenburgHolidays(now = new Date()): Promise<HolidayData | null> {
  // The API limits the range to three years.
  const from = dayKey(addDays(now, -60));
  const to = dayKey(addDays(now, 730));
  const url =
    'https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-BB&languageIsoCode=DE' +
    `&validFrom=${from}&validTo=${to}`;
  const json = await httpRequest<unknown>({ url, headers: { Accept: 'application/json' } });
  const periods = parseOpenHolidays(json);
  if (periods.length < 3) return null;
  return { periods, source: 'online', updatedAt: now.toISOString() };
}
