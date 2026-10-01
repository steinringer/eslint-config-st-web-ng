import { Inject } from '@steinringer/angular-ts-decorators';
import { RIGHT_SERVICE, UNREGISTERED_SERVICE, RightService, WrongService } from './typed-service';

export class TypedInjection {
    constructor(
        @Inject(RIGHT_SERVICE) private right: RightService,
        @Inject(RIGHT_SERVICE) private wrong: WrongService,
        @Inject(RIGHT_SERVICE) private loose: any,
        @Inject(UNREGISTERED_SERVICE) private unresolved: WrongService,
        @Inject('$scope') private scope: unknown
    ) {}
}
