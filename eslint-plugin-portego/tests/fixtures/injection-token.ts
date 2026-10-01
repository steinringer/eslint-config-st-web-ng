import { Inject as HybridInject, NgModule as HybridNgModule } from '@steinringer/angular-ts-decorators';
import { NgModule } from '@angular/core';
import { GOOD_TOKEN, badToken, providerToken, hybridProviderToken, unusedToken } from './tokens';

export class HybridComponent {
    constructor(
        @HybridInject(GOOD_TOKEN) private good: unknown,
        @HybridInject(badToken) private bad: unknown,
        @HybridInject('legacyString') private legacy: unknown
    ) { }
}

@NgModule({ providers: [{ provide: providerToken, useValue: {} }] })
export class HybridModule { }

@HybridNgModule({ providers: [{ provide: hybridProviderToken, useValue: {} }] })
export class RealHybridModule { }

export const unrelatedObject = { provide: unusedToken };
