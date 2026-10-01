import { Component } from '@steinringer/angular-ts-decorators';

@Component({
    template: `<div ng-if="$ctrl.hidden">{{ $ctrl.visible }}</div><div>{{$ctrl.protectedValue}}</div><p>$ctrl.hidden</p><div ng-if="'$ctrl.hidden'">{{ '$ctrl.hidden' }}</div>`
})
export class VisibilityComponent {
    private hidden = true;
    protected protectedValue = 'x';
    visible = 'x';
}

@Component({
    template: '<div ng-non-bindable>{{$ctrl.literal}}</div><div ng-repeat="$ctrl in rows">{{$ctrl.rowValue}}</div><div ng-controller="Other as $ctrl">{{$ctrl.other}}</div>'
})
export class OtherTemplateScopesComponent {
    private literal = true;
    private rowValue = true;
    private other = true;
}

@Component({
    template: '<header data-ng-repeat-start="$ctrl in rows"></header><div>{{$ctrl.rowValue}}</div><div ng-repeat-start="item in items"></div><footer ng-repeat-end></footer><footer data-ng-repeat-end>{{$ctrl.rowValue}}</footer>'
})
export class RepeatedTemplateScopeComponent {
    private rowValue = true;
}

@Component({ template: '<div ng-repeat="item in rows as $ctrl"></div><p>{{$ctrl.rowValue}}</p>' })
export class RepeatAliasComponent {
    private rowValue = true;
}

@Component({ controllerAs: 'vm', template: '<p>{{$ctrl.rowValue}}</p>' })
export class DifferentControllerAliasComponent {
    private rowValue = true;
}

@Component({ template: '<div ng-repeat-start="item in items"></div><p>{{$ctrl.afterRepeat}}</p><footer ng-repeat-end></footer>' })
export class UnshadowedRepeatComponent {
    private afterRepeat = true;
}

export function unrelatedDecorator(Component: (options: object) => ClassDecorator) {
    @Component({ template: '<p>{{$ctrl.hidden}}</p>' })
    class UnrelatedComponent { private hidden = true; }
    return UnrelatedComponent;
}
