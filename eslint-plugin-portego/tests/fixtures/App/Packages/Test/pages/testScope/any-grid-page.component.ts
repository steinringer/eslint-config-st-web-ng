import { Component } from '@steinringer/angular-ts-decorators';
import { PortegoGridOptions } from '../../../../Core/directives/formElements/portego-grid-options';

@Component({ template: '<div grid options="$ctrl.options"></div>' })
export class AnyGridPageComponent {
    options: PortegoGridOptions | any;
}
