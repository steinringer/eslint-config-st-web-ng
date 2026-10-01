import { Component } from '@steinringer/angular-ts-decorators';

@Component({ templateUrl: './external-visibility.component.html' })
export class ExternalVisibilityComponent {
    private hidden = true;
    visible = 'x';
}
