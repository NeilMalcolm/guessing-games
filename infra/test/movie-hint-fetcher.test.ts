import { PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
const { handler } = require('../src/movie-hint-fetcher') as typeof import('../src/movie-hint-fetcher');


const mockLimit = jest.fn();
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockIs = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ is: mockIs }));
const mockUpsert = jest.fn();

process.env.SUPABASE_URL = 'https://example.com';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.TMDB_ACCESS_TOKEN = 'test-tmdb-token';
process.env.R2_ACCOUNT_ID = 'test-account';
process.env.R2_ACCESS_KEY_ID = 'test-r2-key';
process.env.R2_SECRET_ACCESS_KEY = 'test-r2-secret';
process.env.R2_BUCKET_NAME = 'test-bucket';

// Supabase mocks
const mockFrom = jest.fn((table: string) => {
  if (table === 'movies') {
    return { select: mockSelect };
  }
  if (table === 'movie_hints') {
    return { upsert: mockUpsert };
  }
  throw new Error(`Unexpected table: ${table}`);
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: (table: string) => mockFrom(table),
  })),
}));

// R2 mocks
const mockR2Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: (...args: unknown[]) => mockR2Send(...args),
  })),
  PutObjectCommand: jest.fn((input) => ({ input })),
}));

// sharp mocks
const mockToBuffer = jest.fn();
const mockWebp = jest.fn(() => ({ toBuffer: mockToBuffer }));
const mockResize = jest.fn(() => ({ webp: mockWebp }));
jest.mock('sharp', () => jest.fn(() => ({ resize: mockResize })));

// logger mock
jest.mock('@aws-lambda-powertools/logger', () => ({
  Logger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('movie-hint-fetcher handler', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockR2Send.mockResolvedValue({});
    mockUpsert.mockResolvedValue({ error: null });
    mockToBuffer.mockResolvedValue(Buffer.from('webp-bytes'));
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('does nothing when no movies are missing hints', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await handler({});

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockR2Send).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('fetches TMDB hints, pixelates poster, uploads to R2, and upserts to movie_hints', async () => {
    mockLimit.mockResolvedValue({ data: [{ id: 123 }], error: null });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          poster_path: '/abc.jpg',
          tagline: 'An epic tagline',
          keywords: {
            keywords: [
              { id: '1', name: 'space' },
              { id: '2', name: 'rescue' },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      });

    await handler({});

    // 1. TMDB API call includes Bearer auth
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.themoviedb.org/3/movie/123?append_to_response=keywords',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-tmdb-token',
        }),
      })
    );

    // 2. Poster download & sharp pixelation
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://image.tmdb.org/t/p/w342/abc.jpg'
    );
    expect(sharp).toHaveBeenCalled();
    expect(mockResize).toHaveBeenCalledWith(20, 30, { fit: 'fill' });
    expect(mockWebp).toHaveBeenCalledWith({ quality: 80 });

    // 3. R2 upload
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: expect.stringMatching(/^posters\/[0-9a-f-]+\.webp$/),
        Body: Buffer.from('webp-bytes'),
        ContentType: 'image/webp',
      })
    );
    expect(mockR2Send).toHaveBeenCalledTimes(1);

    // 4. Supabase upsert
    expect(mockUpsert).toHaveBeenCalledWith({
      movie_id: 123,
      poster_key: expect.stringMatching(/^[0-9a-f-]+$/),
      keywords: ['space', 'rescue'],
      tagline: 'An epic tagline',
    });
  });

  it('skips R2 upload and DB write when poster_path is missing', async () => {
    mockLimit.mockResolvedValue({ data: [{ id: 456 }], error: null });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 456,
        poster_path: null,
        tagline: 'No poster',
        keywords: { keywords: [] },
      }),
    });

    await handler({});

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockR2Send).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('throws when querying movies fails', async () => {
    const dbError = { message: 'connection failed' };
    mockLimit.mockResolvedValue({ data: null, error: dbError });

    await expect(handler({})).rejects.toEqual(dbError);
  });

  it('throws when TMDB API returns a non-OK response', async () => {
    mockLimit.mockResolvedValue({ data: [{ id: 789 }], error: null });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(handler({})).rejects.toThrow(
      "Failed to retrieve hint data from TMDB API for '789': 404"
    );
  });

  it('throws when upserting to movie_hints fails', async () => {
    mockLimit.mockResolvedValue({ data: [{ id: 321 }], error: null });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 321,
          poster_path: '/poster.jpg',
          tagline: 'Tag',
          keywords: { keywords: [] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([1, 2]).buffer,
      });

    const upsertError = { message: 'constraint violation' };
    mockUpsert.mockResolvedValue({ error: upsertError });

    await expect(handler({})).rejects.toEqual(upsertError);
  });
});
