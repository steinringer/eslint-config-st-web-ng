import { Injectable } from '@steinringer/angular-ts-decorators';
import { GenericDataCore } from '../../../../Core/services/generic-data-core.service';

export const CORE_WEB_PROXY = 'coreWebProxy';
const BASE_URL = '/api/test/core';

@Injectable(CORE_WEB_PROXY)
export class CoreWebProxy {
    constructor(private data: GenericDataCore) {}

    get(): Promise<unknown> { return this.data.get$(`${BASE_URL}/get`); }

    unrelated(): Promise<unknown> {
        const helper = { get$: (url: string) => Promise.resolve(url) };
        return helper.get$('/unrelated');
    }
}
