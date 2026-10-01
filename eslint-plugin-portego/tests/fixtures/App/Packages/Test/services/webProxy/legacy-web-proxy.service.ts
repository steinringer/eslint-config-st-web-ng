import { Injectable } from '@steinringer/angular-ts-decorators';
import { GenericData } from '../../../../Core/services/generic-data.service';

export const LEGACY_WEB_PROXY = 'legacyWebProxy';

@Injectable(LEGACY_WEB_PROXY)
export class LegacyWebProxy {
    constructor(private data: GenericData) {}

    get(): Promise<unknown> { return this.data.getData('/api/example/get'); }
}
