import { Component } from '@steinringer/angular-ts-decorators';

@Component({ selector: 'testConditionalModalPage', template: '<div page class="page-content"><div grid options="$ctrl.options"></div><div *ngIf="showModal" actionmodal modal-name="edit"></div></div>' })
export class ConditionalModalPageComponent {}
