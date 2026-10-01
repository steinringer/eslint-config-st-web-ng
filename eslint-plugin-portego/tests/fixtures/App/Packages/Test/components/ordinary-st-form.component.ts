import { Component } from '@steinringer/angular-ts-decorators';

interface STFormOptions {
    fields: string[];
}

@Component({ selector: 'testOrdinaryStForm', template: '<st-form options="$ctrl.options"></st-form>' })
export class OrdinaryStFormComponent {
    options: STFormOptions;
}
