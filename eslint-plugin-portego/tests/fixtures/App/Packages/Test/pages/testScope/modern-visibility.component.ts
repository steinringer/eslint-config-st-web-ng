import { Component } from '@angular/core';

@Component({ template: `<div ng-if="$ctrl.hidden"></div>` })
export class ModernVisibilityComponent {
    private hidden = true;
}
