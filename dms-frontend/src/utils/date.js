// Datum-Formatierung fuer Listen / Detailbereiche.
// Liefert relative Zeitangaben fuer juengere Daten und faellt fuer aeltere
// auf das Standard-Format zurueck.

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function formatDateOnly(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`
}

export function formatRelative(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < MINUTE) return 'gerade eben'
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE)
    return `vor ${mins} Min.`
  }
  if (isSameDay(now, d)) return `Heute, ${formatTime(d)}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(yesterday, d)) return `Gestern, ${formatTime(d)}`

  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY)
    return `vor ${days} Tagen`
  }

  return formatDateOnly(d)
}

export function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${formatDateOnly(d)}, ${formatTime(d)}`
}

export function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return formatDateOnly(d)
}
