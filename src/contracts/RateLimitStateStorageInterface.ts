import { RateLimitState } from "../RateLimitState";

export abstract class RateLimitStateStorageInterface {
    public abstract setState(state: RateLimitState): Promise<void>;

    public abstract getState(appID: string): Promise<RateLimitState | undefined>;
}
