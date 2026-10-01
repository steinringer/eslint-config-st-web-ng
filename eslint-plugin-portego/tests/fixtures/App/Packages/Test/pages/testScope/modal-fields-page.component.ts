import { Component } from '@steinringer/angular-ts-decorators';

@Component({ selector: 'testModalFieldsPage', template: '<div page class="page-content"><div actionmodal modal-name="edit"><div form-wrapper><form name="edit"><div date-textbox ng-model="$ctrl.date"></div><dropdown ng-model="$ctrl.choice"></dropdown><form-row><div date-textbox ng-model="$ctrl.otherDate"></div></form-row><ui-select ng-model="$ctrl.person"></ui-select></form></div></div></div>' })
export class ModalFieldsPageComponent {}
