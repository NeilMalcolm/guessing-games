export interface SearchResult {
    id: number;
    title: string;
    imagePath: string | null;
    alreadyGuessed?: boolean;
}

export interface SearchResponse {
    results: SearchResult[];
}
