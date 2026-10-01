import { Component } from '@steinringer/angular-ts-decorators';
import { PortegoGridOptions } from '../../../../Core/directives/formElements/portego-grid-options';

@Component({
    selector: 'testGridPage',
    template: '<div page class="page-content"><div grid options="$ctrl.options"></div></div>'
})
export class GridPageComponent {
    options: PortegoGridOptions;
    columnDefs: number[];
}
