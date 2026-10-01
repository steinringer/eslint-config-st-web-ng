import { Injectable } from '@steinringer/angular-ts-decorators';
import { GenericDataCore } from '../../../../Core/services/generic-data-core.service';

export const WRONG_ROUTE_WEB_PROXY = 'wrongRouteWebProxy';
const BASE_URL = '/api/other/wrongRoute';

@Injectable(WRONG_ROUTE_WEB_PROXY)
export class WrongRouteWebProxy {
    constructor(private data: GenericDataCore) {}

    get(): Promise<unknown> { return this.data.get$(`${BASE_URL}/get`); }
}
