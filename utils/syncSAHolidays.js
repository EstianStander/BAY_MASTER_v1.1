/**
 * Fetches South African public holidays from the Nager.Date API
 * and upserts them into the Holiday collection as 'system' holidays.
 *
 * API: https://date.nager.at/api/v3/PublicHolidays/{year}/ZA
 * Free, no API key required.
 */

const Holiday = require('../models/HolidayModel');

const NAGER_BASE = 'https://date.nager.at/api/v3/PublicHolidays';

/**
 * Fetch SA holidays for a given year from the public API.
 * Returns an array of { name, date } or empty array on failure.
 */
async function fetchYear(year) {
  try {
    const res = await fetch(`${NAGER_BASE}/${year}/ZA`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((h) => ({
      name: h.localName || h.name,
      date: h.date, // 'YYYY-MM-DD'
    }));
  } catch {
    // Network error or timeout — silently skip
    return [];
  }
}

/**
 * Sync SA public holidays for the current year and the next year
 * into the database. Uses upsert so existing entries are not duplicated.
 * Only touches 'system' holidays — user-created 'manual' ones are untouched.
 */
async function syncSAHolidays() {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() + 1];

  const all = [];
  for (const year of years) {
    const holidays = await fetchYear(year);
    all.push(...holidays);
  }

  if (all.length === 0) return; // API unreachable, do nothing

  const ops = all.map((h) => ({
    updateOne: {
      filter: { date: new Date(h.date + 'T00:00:00.000Z') },
      update: { $setOnInsert: { name: h.name, source: 'system' } },
      upsert: true,
    },
  }));

  await Holiday.bulkWrite(ops, { ordered: false }).catch(() => {});
}

module.exports = syncSAHolidays;
