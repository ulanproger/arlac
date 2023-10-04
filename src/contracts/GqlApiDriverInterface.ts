import { AxiosRequestConfig, AxiosResponse } from "axios";

import { RateLimit } from "../RateLimit";
import { RateLimitState } from "../RateLimitState";

export abstract class GqlApiDriverInterface {
    public abstract getLatestState(
        rateLimit: RateLimit,
        results: Array<PromiseSettledResult<Awaited<Promise<AxiosResponse>>>>,
    ): RateLimitState | undefined;

    public abstract estimateRequestCost(request: AxiosRequestConfig): Promise<number>;
}
