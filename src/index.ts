import axios, { CreateAxiosDefaults } from "axios";

import { GqlApiDriverInterface } from "./contracts/GqlApiDriverInterface";
import { RateLimitStateStorageInterface } from "./contracts/RateLimitStateStorageInterface";
import { RestApiDriverInterface } from "./contracts/RestApiDriverInterface";
import { RateLimit } from "./RateLimit";
import { RateLimitAwareGql } from "./RateLimitAwareGql";
import { RateLimitAwareRest } from "./RateLimitAwareRest";
import { RateLimitForecastCalculator } from "./RateLimitForecastCalculator";
import { RateLimitStateStorageInMemory } from "./RateLimitStateStorageInMemory";

export * from "./contracts/RateLimitStateStorageInterface";
export * from "./contracts/RestApiDriverInterface";
export * from "./contracts/GqlApiDriverInterface";

export * from "./RateLimit";
export * from "./ParallelRequest";
export * from "./RateLimitState";
export * from "./RateLimitAwareRest";
export * from "./RateLimitAwareGql";

const calculator = new RateLimitForecastCalculator();
const defaultRestStorage = new RateLimitStateStorageInMemory();
const defaultGqlStorage = new RateLimitStateStorageInMemory();
export const createRestClient = (options: {
    axiosDefaultConfig: CreateAxiosDefaults;
    rateLimit: RateLimit;
    apiDriver: RestApiDriverInterface;
    rateLimitStateStorage?: RateLimitStateStorageInterface;
}): RateLimitAwareRest => {
    return new RateLimitAwareRest(
        axios.create(options.axiosDefaultConfig),
        options.rateLimit,
        options.apiDriver,
        calculator,
        options.rateLimitStateStorage || defaultRestStorage,
    );
};

export const createGqlClient = (options: {
    axiosDefaultConfig: CreateAxiosDefaults;
    rateLimit: RateLimit;
    apiDriver: GqlApiDriverInterface;
    rateLimitStateStorage?: RateLimitStateStorageInterface;
}): RateLimitAwareGql => {
    return new RateLimitAwareGql(
        axios.create(options.axiosDefaultConfig),
        options.rateLimit,
        options.apiDriver,
        new RateLimitForecastCalculator(),
        options.rateLimitStateStorage || defaultGqlStorage,
    );
};
