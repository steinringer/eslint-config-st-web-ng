import { Component } from '@steinringer/angular-ts-decorators';

@Component({ templateUrl: '../external-visibility.component.html' })
export class SharedVisibilityComponent {
    private hidden = true;
    visible = 'x';
}
