declare module '@steinringer/angular-ts-decorators' {
    export function Inject(token: string): ParameterDecorator;
    export function NgModule(options: unknown): ClassDecorator;
    export function Component(options: unknown): ClassDecorator;
    export function Injectable(token: string): ClassDecorator;
}
