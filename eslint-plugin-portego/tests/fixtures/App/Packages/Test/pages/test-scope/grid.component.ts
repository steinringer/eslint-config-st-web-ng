import { Component } from '@steinringer/angular-ts-decorators';

interface PortegoGridOptions {
    columnDefs?: number[];
}

@Component({
    selector: 'wrongSelector',
    template: '<div grid options="$ctrl.options"></div>'
})
export class GridPageComponent {
    options: PortegoGridOptions;
}
