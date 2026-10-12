import { describe, it, expect } from 'vitest';
import { isIsoDate } from '$lib/utils/playDate';
import { match } from './isodate';

describe('isIsoDate', () => {
	it.each(['2026-10-11', '2026-01-01', '1999-12-31'])('accepts %s', (value) => {
		expect(isIsoDate(value)).toBe(true);
	});

	it.each([
		'',
		'movies',
		'2026-1-1',
		'26-10-11',
		'2026/10/11',
		'20261011',
		'2026-10-11T00:00:00Z',
		' 2026-10-11',
		'2026-10-11\n',
		'2026-10-111',
		'abcd-ef-gh'
	])('rejects %j', (value) => {
		expect(isIsoDate(value)).toBe(false);
	});
});

describe('isodate param matcher', () => {
	it('matches ISO dates', () => {
		expect(match('2026-10-11')).toBe(true);
	});

	it('does not match other route segments', () => {
		expect(match('movies')).toBe(false);
		expect(match('2026-10')).toBe(false);
	});
});

