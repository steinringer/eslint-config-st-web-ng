import { Injectable } from '@steinringer/angular-ts-decorators';

class GenericData {
    getData(url: string): Promise<unknown> { return Promise.resolve(url); }
}

export const LOOKALIKE_WEB_PROXY = 'lookalikeWebProxy';

@Injectable(LOOKALIKE_WEB_PROXY)
export class LookalikeWebProxy {
    constructor(private data: GenericData) {}

    get(): Promise<unknown> { return this.data.getData('/api/example/get'); }
}
