import { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

import { RateLimitStateStorageInterface } from "./contracts/RateLimitStateStorageInterface";
import { RestApiDriverInterface } from "./contracts/RestApiDriverInterface";
import { ParallelRequest } from "./ParallelRequest";
import { RateLimit } from "./RateLimit";
import { RateLimitForecastCalculator } from "./RateLimitForecastCalculator";
import { RateLimitState } from "./RateLimitState";

export class RateLimitAwareRest {
    private prcList: ParallelRequest[];

    private promise: Promise<void> | undefined;

    public constructor(
        private readonly axios: AxiosInstance,
        private readonly rateLimit: RateLimit,
        private readonly apiDriver: RestApiDriverInterface,
        private readonly rateLimitCalculator: RateLimitForecastCalculator,
        private readonly rateLimitStateStorage: RateLimitStateStorageInterface,
    ) {
        this.prcList = [];
    }

    public async call<T>(config: AxiosRequestConfig): Promise<T> {
        const response = await new Promise<AxiosResponse>((resolve, reject) => {
            this.prcList.push({
                config: config,
                resolve,
                reject,
            });
            this.proceed();
        });
        return this.apiDriver.parseResponse<T>(response);
    }

    private async parallelRequests(): Promise<void> {
        if (this.prcList.length === 0) {
            return;
        }
        const state = await this.rateLimitStateStorage.getState(this.rateLimit.appID);
        let chunkSize = this.rateLimit.bucketSize;
        if (state) {
            const ms = this.rateLimitCalculator.getWaitMS(
                state,
                Math.min(this.rateLimitCalculator.getLimit(state), this.prcList.length),
            );
            if (ms > 0) {
                await this.delay(ms);
            }
            chunkSize = this.rateLimitCalculator.getLimit(state);
        }
        const chunk = this.prcList.splice(0, chunkSize);
        const throttledRequests: ParallelRequest[] = [];
        const results = await Promise.allSettled(
            chunk.map((request) => {
                const promise = this.axios.request(request.config);
                promise.then(request.resolve).catch((reason: any) => {
                    if (reason instanceof AxiosError && reason.response?.status === 429) {
                        throttledRequests.push(request);
                        return;
                    }
                    request.reject(reason);
                });
                return promise;
            }),
        );
        await this.refreshState(results);
        this.prcList.push(...throttledRequests);
        return await this.parallelRequests();
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async refreshState(results: Array<PromiseSettledResult<Awaited<Promise<AxiosResponse>>>>): Promise<void> {
        let latestState: RateLimitState | undefined;
        for (const result of results) {
            let state: RateLimitState | undefined;
            if (result.status === "fulfilled") {
                state = this.createState(this.rateLimit, result.value);
            } else if (result.reason instanceof AxiosError && result.reason.response) {
                state = this.createState(this.rateLimit, result.reason.response);
            }
            if (!latestState || (state && latestState?.countLeft > state?.countLeft)) {
                latestState = state;
            }
            if (latestState && !latestState.countLeft) {
                break;
            }
        }
        if (latestState) {
            await this.rateLimitStateStorage.setState(latestState);
        }
    }

    private createState(rateLimit: RateLimit, axiosResponse: AxiosResponse): RateLimitState {
        return {
            rateLimit: rateLimit,
            lastRequestTime: new Date(axiosResponse.headers["date"]),
            countLeft: this.apiDriver.countLeft(rateLimit, axiosResponse),
            retryAfterMS: this.apiDriver.retryAfterMS(axiosResponse),
        };
    }

    private proceed(): void {
        if (!this.promise) {
            this.promise = this.parallelRequests().then(() => {
                this.promise = undefined;
            });
        }
    }
}
