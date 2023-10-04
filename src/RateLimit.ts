export interface RateLimit {
    readonly appID: string;

    /**
     * Max count of allowed parallel api calls
     */
    readonly bucketSize: number;

    /**
     * Bandwidth or request per second
     */
    readonly leakRate: number;
}
