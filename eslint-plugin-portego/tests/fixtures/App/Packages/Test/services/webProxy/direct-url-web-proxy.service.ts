import { Injectable } from '@steinringer/angular-ts-decorators';
import { GenericDataCore } from '../../../../Core/services/generic-data-core.service';

export const DIRECT_URL_WEB_PROXY = 'directUrlWebProxy';
const BASE_URL = '/api/test/directUrl';

@Injectable(DIRECT_URL_WEB_PROXY)
export class DirectUrlWebProxy {
    constructor(private data: GenericDataCore) {}

    get(): Promise<unknown> { return this.data.get$('/api/test/directUrl/get'); }
}
