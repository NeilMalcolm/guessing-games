export function debounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    // Clear the previous timer if the user types again before the delay finishes
    clearTimeout(timeoutId);

    // Set a new timer
    timeoutId = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}