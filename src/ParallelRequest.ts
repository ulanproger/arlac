import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

export interface ParallelRequest {
    readonly config: AxiosRequestConfig;
    resolve(value: AxiosResponse): void;
    reject(reason: AxiosError | AxiosResponse): void;
}
