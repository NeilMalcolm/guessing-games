export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: '14.17';
	};
	public: {
		Tables: {
			daily_movies: {
				Row: {
					created_at: string;
					custom_hints: Json | null;
					movie_id: number;
					play_date: string;
				};
				Insert: {
					created_at?: string;
					custom_hints?: Json | null;
					movie_id: number;
					play_date: string;
				};
				Update: {
					created_at?: string;
					custom_hints?: Json | null;
					movie_id?: number;
					play_date?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'daily_movies_movie_id_fkey';
						columns: ['movie_id'];
						isOneToOne: false;
						referencedRelation: 'movies';
						referencedColumns: ['id'];
					}
				];
			};
			game_sessions: {
				Row: {
					created_at: string;
					id: string;
					max_attempts: number;
					status: string;
					target_movie_id: number;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					max_attempts?: number;
					status?: string;
					target_movie_id: number;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					max_attempts?: number;
					status?: string;
					target_movie_id?: number;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'game_sessions_target_movie_id_fkey';
						columns: ['target_movie_id'];
						isOneToOne: false;
						referencedRelation: 'movies';
						referencedColumns: ['id'];
					}
				];
			};
			guesses: {
				Row: {
					created_at: string;
					game_id: string;
					guess_number: number;
					id: string;
					is_correct: boolean;
					movie_id: number;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					game_id: string;
					guess_number: number;
					id?: string;
					is_correct?: boolean;
					movie_id: number;
					user_id: string;
				};
				Update: {
					created_at?: string;
					game_id?: string;
					guess_number?: number;
					id?: string;
					is_correct?: boolean;
					movie_id?: number;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'guesses_game_id_fkey';
						columns: ['game_id'];
						isOneToOne: false;
						referencedRelation: 'game_sessions';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'guesses_movie_id_fkey';
						columns: ['movie_id'];
						isOneToOne: false;
						referencedRelation: 'movies';
						referencedColumns: ['id'];
					}
				];
			};
			movie_hints: {
				Row: {
					created_at: string;
					hints_fetched_at: string;
					keywords: string[];
					movie_id: number;
					poster_key: string | null;
					tagline: string | null;
				};
				Insert: {
					created_at?: string;
					hints_fetched_at?: string;
					keywords?: string[];
					movie_id: number;
					poster_key?: string | null;
					tagline?: string | null;
				};
				Update: {
					created_at?: string;
					hints_fetched_at?: string;
					keywords?: string[];
					movie_id?: number;
					poster_key?: string | null;
					tagline?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'movie_hints_movie_id_fkey';
						columns: ['movie_id'];
						isOneToOne: true;
						referencedRelation: 'movies';
						referencedColumns: ['id'];
					}
				];
			};
			movies: {
				Row: {
					box_office: number | null;
					cached_at: string;
					cast_members: Json;
					certifications: Json | null;
					director: string | null;
					director_profile_path: string | null;
					genres: string[] | null;
					id: number;
					min_age: number | null;
					popularity: number | null;
					poster_path: string | null;
					rating: number | null;
					release_year: number | null;
					title: string;
					video: string | null;
					vote_count: number | null;
				};
				Insert: {
					box_office?: number | null;
					cached_at?: string;
					cast_members?: Json;
					certifications?: Json | null;
					director?: string | null;
					director_profile_path?: string | null;
					genres?: string[] | null;
					id: number;
					min_age?: number | null;
					popularity?: number | null;
					poster_path?: string | null;
					rating?: number | null;
					release_year?: number | null;
					title: string;
					video?: string | null;
					vote_count?: number | null;
				};
				Update: {
					box_office?: number | null;
					cached_at?: string;
					cast_members?: Json;
					certifications?: Json | null;
					director?: string | null;
					director_profile_path?: string | null;
					genres?: string[] | null;
					id?: number;
					min_age?: number | null;
					popularity?: number | null;
					poster_path?: string | null;
					rating?: number | null;
					release_year?: number | null;
					title?: string;
					video?: string | null;
					vote_count?: number | null;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			movie_search: {
				Args: { search_term: string };
				Returns: {
					id: number;
					poster_path: string;
					release_year: number;
					title: string;
				}[];
			};
			record_guess_atomic: {
				Args: {
					p_game_id: string;
					p_guess_number: number;
					p_is_correct: boolean;
					p_movie_id: number;
					p_new_status: string;
					p_user_id: string;
				};
				Returns: Json;
			};
			show_limit: { Args: never; Returns: number };
			show_trgm: { Args: { '': string }; Returns: string[] };
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never) = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never) = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {}
	}
} as const;
