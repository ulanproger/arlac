import { AxiosError, AxiosInstance, AxiosResponse } from "axios";

import { GqlApiDriverInterface } from "./contracts/GqlApiDriverInterface";
import { RateLimitStateStorageInterface } from "./contracts/RateLimitStateStorageInterface";
import { ParallelRequest } from "./ParallelRequest";
import { RateLimit } from "./RateLimit";
import { RateLimitForecastCalculator } from "./RateLimitForecastCalculator";
import { RateLimitState } from "./RateLimitState";

type Errors = [
    {
        message: string;
        locations?: [
            {
                line: number;
                column: number;
            },
        ];
        path?: string | number[];
        extensions?: {
            code?: string;
            timestamp?: string;
        };
        code?: string;
        timestamp?: string;
    },
];
export interface GqlResponseSuccess<P = any, E = { [key: string]: any }> {
    data: P;
    errors?: Errors;
    extensions?: E;
}
export interface GqlResponseError<E = { [key: string]: any }> {
    data?: undefined;
    errors: Errors;
    extensions?: E;
}

export interface GqlRequest {
    query: string;
    variables?: {
        [key: string]: any;
    };
}

export class RateLimitAwareGql {
    private readonly prcList: ParallelRequest[];

    private promise: Promise<void> | undefined;

    public constructor(
        private readonly axios: AxiosInstance,
        private readonly rateLimit: RateLimit,
        private readonly apiDriver: GqlApiDriverInterface,
        private readonly rateLimitCalculator: RateLimitForecastCalculator,
        private readonly rateLimitStateStorage: RateLimitStateStorageInterface,
    ) {
        this.prcList = [];
    }

    public async call<T>(request: GqlRequest): Promise<T> {
        const response = await new Promise<AxiosResponse<GqlResponseSuccess<T>>>(
            (resolve, reject: { (reason: AxiosResponse<GqlResponseError> | AxiosError): void }) => {
                this.prcList.push({
                    config: {
                        method: "POST",
                        url: "graphql.json",
                        data: request,
                    },
                    resolve: resolve,
                    reject: reject,
                });
                this.proceed();
            },
        );
        return response.data.data;
    }

    private async parallelRequests(): Promise<void> {
        if (this.prcList.length === 0) {
            return;
        }
        const state = await this.rateLimitStateStorage.getState(this.rateLimit.appID);
        if (state) {
            const ms = this.rateLimitCalculator.getWaitMS(state, await this.getTotalCost(this.prcList));
            if (ms > 0) {
                await this.delay(ms);
            }
        }
        const throttledRequests: ParallelRequest[] = [];
        const chunk = await this.getNearestChunk(this.prcList, state);
        const results = await Promise.allSettled(
            chunk.map((request) => {
                const promise = this.axios.request(request.config);
                promise
                    .then((value: AxiosResponse<GqlResponseSuccess | GqlResponseError>) => {
                        if (!value.data.errors) {
                            request.resolve(value);
                            return;
                        }
                        if (
                            value.data.errors &&
                            value.data.errors
                                .map((err: any) => {
                                    return err.extensions?.code;
                                })
                                .includes("THROTTLED")
                        ) {
                            throttledRequests.push(request);
                            return;
                        }
                        request.reject(value);
                    })
                    .catch(request.reject);
                return promise;
            }),
        );
        const newState = this.apiDriver.getLatestState(this.rateLimit, results);
        if (newState) {
            await this.rateLimitStateStorage.setState(newState);
        }
        this.prcList.push(...throttledRequests);
        await this.parallelRequests();
    }

    private async getNearestChunk(
        requestList: ParallelRequest[],
        state: RateLimitState | undefined,
    ): Promise<ParallelRequest[]> {
        const limit = state ? this.rateLimitCalculator.getLimit(state) : this.rateLimit.bucketSize;
        const chunkSize = await this.getNearestChunkSize(limit, requestList);
        return requestList.splice(0, chunkSize);
    }

    private async getNearestChunkSize(limit: number, requestList: ParallelRequest[]): Promise<number> {
        let costTotal = 0;
        let chunkSize = 0;
        for await (const request of requestList) {
            const actualCost = (await this.apiDriver.estimateRequestCost(request.config)) || this.rateLimit.bucketSize;
            costTotal += actualCost;
            if (costTotal > limit) {
                break;
            }
            chunkSize++;
        }
        return chunkSize || 1;
    }

    private async getTotalCost(requestList: ParallelRequest[]) {
        let costTotal = 0;
        for await (const request of requestList) {
            costTotal += await this.apiDriver.estimateRequestCost(request.config);
        }
        return costTotal;
    }

    private proceed(): void {
        if (!this.promise) {
            this.promise = this.parallelRequests().then(() => {
                this.promise = undefined;
            });
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
