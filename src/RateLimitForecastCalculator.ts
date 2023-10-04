import { RateLimitState } from "./RateLimitState";

export class RateLimitForecastCalculator {
    public getLimit(rateLimitState: RateLimitState): number {
        const { lastRequestTime, rateLimit, countLeft } = rateLimitState;
        const seconds = (Date.now() - lastRequestTime.getTime()) / 1000;
        return Math.min(seconds * rateLimit.leakRate + countLeft, rateLimit.bucketSize);
    }

    public getWaitMS(rateLimitState: RateLimitState, requestCountInQueue: number): number {
        const { rateLimit } = rateLimitState;
        const limit = this.getLimit(rateLimitState);
        const remainingRequests = Math.min(requestCountInQueue, rateLimit.bucketSize) - limit;
        return Math.max(Math.ceil((remainingRequests / rateLimit.leakRate) * 1000), rateLimitState.retryAfterMS);
    }
}
