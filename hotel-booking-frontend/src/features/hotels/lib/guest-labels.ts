export function adultsLabel(count: number): string {
  return count === 1 ? "1 Adult" : `${count} Adults`;
}

export function childrenLabel(count: number): string {
  return count === 1 ? "1 Child" : `${count} Children`;
}

export function guestsSummary(adultCount: number, childCount: number): string {
  const parts: string[] = [adultsLabel(adultCount)];
  if (childCount > 0) parts.push(childrenLabel(childCount));
  return parts.join(" · ");
}
