export interface SearchResponse {
    results?: SearchResult[],
    error?: string | null,
    ok: boolean
};

export interface SearchResult {
    id: number,
    title: string,
    imagePath: string | null
}