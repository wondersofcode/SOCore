// Backend timestamps come in two shapes:
//  - naive UTC strings like "2026-09-11 10:14:40" (no timezone marker at all)
//  - real ISO 8601 strings with an offset, e.g. "2026-09-11T10:14:40.123456+00:00"
// Both are normalized to a real UTC instant here, then rendered in the
// viewer's chosen IANA timezone via Intl.DateTimeFormat.
function toDate(timestamp: string): Date | null {
  if (!timestamp) return null
  const iso = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T')
  const hasZone = /[zZ]|[+-]\d\d:\d\d$/.test(iso)
  const date = new Date(hasZone ? iso : `${iso}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export const DEFAULT_TIMEZONE = 'Asia/Baku'

export function formatDateTime(timestamp: string, timezone: string = DEFAULT_TIMEZONE): string {
  const date = toDate(timestamp)
  if (!date) return ''
  return new Intl.DateTimeFormat('az-AZ', { timeZone: timezone, dateStyle: 'short', timeStyle: 'medium' }).format(date)
}

export function formatTime(timestamp: string, timezone: string = DEFAULT_TIMEZONE): string {
  const date = toDate(timestamp)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

// Some backend fields (Alert.detectedAt/enrichedAt/respondedAt) are bare
// "HH:MM:SS" with no date — borrow the date from a sibling full timestamp
// (e.g. the same alert's `timestamp`) so they can still be timezone-converted.
export function formatTimeOfDay(hms: string, referenceTimestamp: string, timezone: string = DEFAULT_TIMEZONE): string {
  if (!hms || !referenceTimestamp) return ''
  const datePart = referenceTimestamp.slice(0, 10)
  return formatTime(`${datePart} ${hms}`, timezone)
}

export function formatISODate(timestamp: string, timezone: string = DEFAULT_TIMEZONE): string {
  const date = toDate(timestamp)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function formatShortDate(timestamp: string, timezone: string = DEFAULT_TIMEZONE): string {
  const date = toDate(timestamp)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, day: '2-digit', month: 'short' }).format(date)
}

export const POPULAR_TIMEZONES: { value: string; label: string }[] = [
  { value: 'Asia/Baku', label: 'Baku (UTC+4)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (UTC+0/+1)' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+1/+2)' },
  { value: 'Europe/Moscow', label: 'Moscow (UTC+3)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (UTC+3)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Asia/Tbilisi', label: 'Tbilisi (UTC+4)' },
  { value: 'Asia/Yerevan', label: 'Yerevan (UTC+4)' },
  { value: 'Asia/Kolkata', label: 'India (UTC+5:30)' },
  { value: 'Asia/Almaty', label: 'Almaty (UTC+6)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
]
