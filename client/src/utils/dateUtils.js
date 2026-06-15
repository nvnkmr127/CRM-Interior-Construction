import { formatDistanceToNow, format, isPast, differenceInDays } from 'date-fns';

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch (e) {
    return dateStr;
  }
}

export function formatDate(dateStr, fmt = 'dd MMM yyyy') {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), fmt);
  } catch (e) {
    return dateStr;
  }
}

export function isOverdue(dateStr) {
  if (!dateStr) return false;
  try {
    return isPast(new Date(dateStr));
  } catch (e) {
    return false;
  }
}

export function daysRemaining(dateStr) {
  if (!dateStr) return 0;
  try {
    return differenceInDays(new Date(dateStr), new Date());
  } catch (e) {
    return 0;
  }
}

export function formatDateRange(startStr, endStr) {
  if (!startStr || !endStr) return '';
  try {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    
    // e.g., '01 Jan - 31 Mar 2025' or '01 Jan 2024 - 31 Mar 2025'
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    
    if (startYear === endYear) {
      return `${format(startDate, 'dd MMM')} - ${format(endDate, 'dd MMM yyyy')}`;
    } else {
      return `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`;
    }
  } catch (e) {
    return `${startStr} - ${endStr}`;
  }
}
