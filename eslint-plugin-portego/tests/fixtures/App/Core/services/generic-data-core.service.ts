export const GENERIC_DATA_CORE = 'genericDataCore';

export class GenericDataCore {
    get$(url: string): Promise<unknown> { return Promise.resolve(url); }
    post$(url: string, body: unknown): Promise<unknown> { return Promise.resolve([url, body]); }
}

export function fromBody<T>(model: T): { body: T } { return { body: model }; }
