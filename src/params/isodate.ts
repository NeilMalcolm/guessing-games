import type { ParamMatcher } from '@sveltejs/kit';
import { isIsoDate } from '$lib/utils/playDate';

/**
 *  Matches an ISO 8601 calendar date (YYYY-MM-DD). 
 */
export const match: ParamMatcher = isIsoDate;
