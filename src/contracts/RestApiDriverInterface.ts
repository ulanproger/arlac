import { AxiosResponse } from "axios";

import { RateLimit } from "../RateLimit";

export abstract class RestApiDriverInterface {
    public abstract parseResponse<T>(response: AxiosResponse<{ [key: string]: T }>): T;

    public abstract countLeft(rateLimit: RateLimit, axiosResponse: AxiosResponse): number;

    public abstract retryAfterMS(axiosResponse: AxiosResponse): number;
}
