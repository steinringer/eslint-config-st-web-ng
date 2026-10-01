import { Component } from '@steinringer/angular-ts-decorators';
import { STFormOptions } from '../../../../Core/directives/formElements/types/form-options';

@Component({ selector: 'testStFormPage', template: '<div page class="page-content"><st-form name="edit" options="$ctrl.formOptions"></st-form></div>' })
export class StFormPageComponent {
    formOptions: STFormOptions;
}
