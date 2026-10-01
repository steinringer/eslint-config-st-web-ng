import { Component } from '@steinringer/angular-ts-decorators';

@Component({ selector: 'testSelectorUse', template: '<testGood></testGood><test-good></test-good><unknownWidget></unknownWidget>' })
export class SelectorUseComponent {}
