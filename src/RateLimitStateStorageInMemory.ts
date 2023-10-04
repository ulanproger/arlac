import { RateLimitStateStorageInterface } from "./contracts/RateLimitStateStorageInterface";
import { RateLimitState } from "./RateLimitState";

export class RateLimitStateStorageInMemory implements RateLimitStateStorageInterface {
    private states: { [key: string]: RateLimitState | undefined } = {};

    public async getState(appId: string): Promise<RateLimitState | undefined> {
        return Promise.resolve(this?.states[appId]);
    }

    public async setState(state: RateLimitState): Promise<void> {
        this.states[state.rateLimit.appID] = state;
        return Promise.resolve();
    }
}
