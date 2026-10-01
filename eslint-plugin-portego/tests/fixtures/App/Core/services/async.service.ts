export class AsyncService {
    await(fn: () => Promise<unknown>): void { void fn(); }
}
