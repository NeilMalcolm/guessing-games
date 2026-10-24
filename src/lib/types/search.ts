export interface SearchResult {
    id: number;
    title: string;
    imagePath: string | null;
}

export interface SearchResponse {
    results: SearchResult[];
}
