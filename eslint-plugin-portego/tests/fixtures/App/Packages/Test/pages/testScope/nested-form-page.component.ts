import { Component } from '@steinringer/angular-ts-decorators';

@Component({ selector: 'testNestedFormPage', template: '<div page class="page-content"><form><st-form name="x" options="$ctrl.options"></st-form></form></div>' })
export class NestedFormPageComponent {}
