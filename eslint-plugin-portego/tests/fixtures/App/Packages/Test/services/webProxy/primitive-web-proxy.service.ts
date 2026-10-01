import { Injectable } from '@steinringer/angular-ts-decorators';
import { GenericDataCore, fromBody } from '../../../../Core/services/generic-data-core.service';

export const PRIMITIVE_WEB_PROXY = 'primitiveWebProxy';
const BASE_URL = '/api/test/primitive';

@Injectable(PRIMITIVE_WEB_PROXY)
export class PrimitiveWebProxy {
    constructor(private data: GenericDataCore) {}

    save(value: number): Promise<unknown> { return this.data.post$(`${BASE_URL}/Save`, value); }
    tagged(value: number): Promise<unknown> { return this.data.post$(`${BASE_URL}/Save`, fromBody(value)); }
    unknown(value: number): Promise<unknown> { return this.data.post$(`${BASE_URL}/Other`, value); }
}
