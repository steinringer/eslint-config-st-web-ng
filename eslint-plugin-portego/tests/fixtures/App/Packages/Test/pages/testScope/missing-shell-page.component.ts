import { Component } from '@steinringer/angular-ts-decorators';

@Component({ selector: 'testMissingShellPage', template: '<section>Content</section>' })
export class MissingShellPageComponent {}

@Component({ selector: 'testMissingShellPage', template: '<div ui-view></div>' })
export class RouteOnlyPageComponent {}
