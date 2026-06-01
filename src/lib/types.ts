export interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

export interface Project {
	id: number;
	region: string;
	year: string;
	flight: string;
	customer_id: number;
	tags: string[];
}

export interface ApiErrorDetail {
	code?: string;
	detail?: string;
	action?: string;
}
