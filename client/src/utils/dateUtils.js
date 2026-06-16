import { formatDistanceToNow, format, isPast, differenceInDays, isToday, isTomorrow } from 'date-fns'

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    // e.g. '3 hours ago', 'in 2 days'
  } catch { return '' }
}

export function formatDate(dateStr, fmt = 'dd MMM yyyy') {
  if (!dateStr) return ''
  try { return format(new Date(dateStr), fmt) }
  catch { return '' }
}

export function formatDateTime(dateStr) {
  return formatDate(dateStr, 'dd MMM yyyy, hh:mm a')
}

export function isOverdue(dateStr) {
  if (!dateStr) return false
  return isPast(new Date(dateStr)) && !isToday(new Date(dateStr))
}

export function daysRemaining(dateStr) {
  if (!dateStr) return null
  return differenceInDays(new Date(dateStr), new Date())
}

export function dueDateLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isToday(d))    return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  const days = daysRemaining(dateStr)
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days < 8) return `${days} days`
  return formatDate(dateStr, 'dd MMM')
}

export function formatDateRange(start, end) {
  if (!start || !end) return ''
  return `${formatDate(start, 'dd MMM')} — ${formatDate(end, 'dd MMM yyyy')}`
}
