import { RateLimit } from "./RateLimit";

export interface RateLimitState {
    readonly rateLimit: RateLimit;
    readonly lastRequestTime: Date;
    readonly countLeft: number;
    readonly retryAfterMS: number;
}
