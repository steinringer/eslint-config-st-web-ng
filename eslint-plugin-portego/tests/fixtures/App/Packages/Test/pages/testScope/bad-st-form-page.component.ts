import { Component } from '@steinringer/angular-ts-decorators';

interface STFormOptions {
    fields: string[];
}

@Component({ selector: 'testBadStFormPage', template: '<div page class="page-content"><st-form options="$ctrl.formOptions"></st-form><st-form name="other"></st-form></div>' })
export class BadStFormPageComponent {
    formOptions: STFormOptions;
}
