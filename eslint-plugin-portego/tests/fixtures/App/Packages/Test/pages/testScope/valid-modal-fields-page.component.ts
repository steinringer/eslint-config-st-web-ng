import { Component } from '@steinringer/angular-ts-decorators';

@Component({ selector: 'testValidModalFieldsPage', template: '<div page class="page-content"><div actionmodal modal-name="edit"><div form-wrapper><form name="edit"><form-row><div date-textbox ng-model="$ctrl.date"></div><dropdown ng-model="$ctrl.choice"></dropdown></form-row><ui-select ng-model="$ctrl.person"></ui-select></form></div></div></div>' })
export class ValidModalFieldsPageComponent {}
