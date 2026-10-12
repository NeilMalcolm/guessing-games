/**
 * Returns true if the value is an ISO 8601 date (YYYY-MM-DD). 
*/
export const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
