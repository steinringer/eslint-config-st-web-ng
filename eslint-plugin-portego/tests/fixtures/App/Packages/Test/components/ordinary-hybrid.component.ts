import { Component } from '@steinringer/angular-ts-decorators';

@Component({ selector: 'wrongOrdinary', template: '<div></div>' })
export class OrdinaryHybridComponent {}

@Component({ selector: 'testGood', template: '<div></div>' })
export class GoodHybridComponent {}

@Component({ selector: 'wrongUnregistered', template: '<div></div>' })
export class UnregisteredHybridComponent {}

@Component({ selector: 'wrongNonPageForm', template: '<form><st-form></st-form></form><section actionmodal><div form-wrapper><form name="edit"><div date-textbox ng-model="$ctrl.date"></div></form></div></section>' })
export class NonPageFormComponent {}
