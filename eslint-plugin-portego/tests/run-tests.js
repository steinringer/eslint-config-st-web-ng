'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ESLint, RuleTester } = require('eslint');
const { registeredHybridSelectors } = require('../dist/rules/page-registration');
const { readRelativeHtmlTemplate } = require('../dist/rules/template-file');

const sharedTemplateRef = path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/nested/shared.component.ts');
assert(readRelativeHtmlTemplate(sharedTemplateRef, '../grid-page.component.html')?.includes('options="$ctrl.options"'));
assert.strictEqual(readRelativeHtmlTemplate(sharedTemplateRef, '../missing.html'), null);
assert.strictEqual(readRelativeHtmlTemplate(sharedTemplateRef, '/runtime/template.html'), null);

const metadataFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'portego-route-metadata-'));
try {
    const config = path.join(metadataFixture, 'Configuration', 'Packages', 'Test');
    fs.mkdirSync(config, { recursive: true });
    fs.writeFileSync(path.join(config, 'routes.data.json'), '\uFEFF[{"pages":[{"route":{"component":"testJsoncPage",}},],}]');
    const component = path.join(metadataFixture, 'App', 'Packages', 'Test', 'pages', 'jsonc-page.component.ts');
    assert(registeredHybridSelectors(component).has('testJsoncPage'));
} finally {
    if (!metadataFixture.startsWith(os.tmpdir() + path.sep))
        throw new Error('Unexpected metadata fixture directory');
    fs.rmSync(metadataFixture, { recursive: true, force: true });
}

const tester = new RuleTester({
    parser: require.resolve('@typescript-eslint/parser'),
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
});

tester.run('component-file-order', require('..').rules['component-file-order'], {
    valid: [
        'import { Component } from "@angular/core"; export const TOKEN = "x"; @Component({}) export class Page {} export interface PageOptions {}',
        'import { Component } from "other"; export interface Options {} @Component({}) export class Page {}'
    ],
    invalid: [
        {
            code: 'import { Component as HybridComponent } from "@steinringer/angular-ts-decorators"; export interface PageOptions {} @HybridComponent({}) export class Page {}',
            errors: [{ messageId: 'order' }]
        },
        {
            code: 'import { Component } from "@angular/core"; @Component({}) export class Page {} export const TOKEN = "x";',
            errors: [{ messageId: 'order' }]
        }
    ]
});

tester.run('role-file-name', require('..').rules['role-file-name'], {
    valid: [
        { filename: 'meeting-page.component.ts', code: 'import { Component } from "@angular/core"; @Component({}) class MeetingPageComponent {}' },
        { filename: 'meeting.ajs.component.ts', code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({}) class MeetingComponent {}' },
        { filename: 'meeting.component.ajs.ts', code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({}) class MeetingComponent {}' },
        { filename: 'Unrelated.ts', code: 'import { Component } from "@angular/core"; function create(Component) { @Component({}) class Unrelated {} }' },
        { filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.ajs.component.ts'), code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({selector: "testGridPage"}) class MeetingComponent {}' },
        { filename: 'billing-web-proxy.service.ts', code: 'import { Injectable } from "@steinringer/angular-ts-decorators"; @Injectable() class BillingWebProxy {}' },
        { filename: 'account-store.ts', code: 'import { Injectable } from "@angular/core"; @Injectable() class AccountStore {}' },
        { filename: 'meetingPage.generated.ts', code: 'import { Component } from "@angular/core"; @Component({}) class MeetingComponent {}' },
        { filename: 'meetingPage.ts', code: 'import { Component } from "other"; @Component({}) class MeetingComponent {}' }
    ],
    invalid: [
        { filename: 'meetingPage.component.ts', code: 'import { Component } from "@angular/core"; @Component({}) class MeetingComponent {}', errors: [{ messageId: 'filename' }] },
        { filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/BadPage.ts'), code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({selector: "testGridPage"}) class MeetingComponent {}', errors: [{ messageId: 'filename' }] },
        { filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid.component.ts'), code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({selector: "testGridPage"}) class MeetingComponent {}', errors: [{ messageId: 'filename' }] },
        { filename: 'meeting.ts', code: 'import { Component } from "@angular/core"; @Component({}) class MeetingComponent {}', errors: [{ messageId: 'filename' }] },
        { filename: 'account.service.ts', code: 'import { Injectable } from "@steinringer/angular-ts-decorators"; @Injectable() class AccountWebProxy {}', errors: [{ messageId: 'filename' }] }
    ]
});

tester.run('component-member-order', require('..').rules['component-member-order'], {
    valid: [
        'import { Component } from "@angular/core"; @Component({}) class Page { readonly name = ""; count = 0; private value = 0; constructor() {} load() {} private save() {} }',
        'import { Component } from "other"; @Component({}) class Plain { private save() {} load() {} }'
    ],
    invalid: [{
        code: 'import { Component } from "@angular/core"; @Component({}) class Page { private helper() {} first() {} second() {} third() {} }',
        errors: [{ messageId: 'order' }]
    }, {
        code: 'import { Component as HybridComponent } from "@steinringer/angular-ts-decorators"; @HybridComponent({}) class Page { private save() {} load() {} }',
        errors: [{ messageId: 'order' }]
    }]
});

tester.run('interface-prefix-standard', require('@typescript-eslint/eslint-plugin').rules['naming-convention'], {
    valid: ['interface IInvoice { id: number; }', 'interface IURL { url: string; }', 'type Invoice = { id: number };']
        .map(code => ({ code, options: require('../../index').rules['@typescript-eslint/naming-convention'].slice(1) })),
    invalid: [
        { code: 'interface Invoice { id: number; }', errors: 1 },
        { code: 'interface Iinvoice { id: number; }', errors: 1 },
        { code: 'interface I { id: number; }', errors: 1 }
    ].map(test => ({ ...test, options: require('../../index').rules['@typescript-eslint/naming-convention'].slice(1) }))
});

tester.run('constructor-property-access', require('..').rules['constructor-property-access'], {
    valid: [
        'import { Inject as HybridInject } from "@steinringer/angular-ts-decorators"; function factory(HybridInject: any) { class C { constructor(@HybridInject(TOKEN) public service: any) { service.run(); } } }',
        'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) private service: any) { this.service.run(); } }',
        'class C { constructor(service: any) { service.run(); } }',
        'class C { constructor(private service: any) { service.run(); } }',
        'import { Inject } from "@angular/core"; class C { constructor(@Inject(TOKEN) private service: any) { service.run(); } }',
        'import { Inject } from "other"; class C { constructor(@Inject(TOKEN) private service: any) { service.run(); } }',
        'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) private service: any) { const f = (service: any) => service.run(); } }',
        'import { Inject } from "@steinringer/angular-ts-decorators"; class C extends B { constructor(@Inject(TOKEN) private service: any) { super(service); this.service.run(); } }',
        'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) private service: any, value = service.run()) {} }',
        'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) private service: any) { function f() { service.run(); } } }'
    ],
    invalid: [
        { code: 'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) private service: any) { service.run(); } }', errors: [{ messageId: 'access' }] },
        { code: 'import { Inject as HybridInject } from "@steinringer/angular-ts-decorators"; class C { constructor(@HybridInject(TOKEN) public readonly service: any) { const f = () => service.run(); } }', errors: [{ messageId: 'access' }] },
        { code: 'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) private service: any = factory()) { service.run(); } }', errors: [{ messageId: 'access' }] },
        { code: 'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) private service: any) { consume({ service }); } }', errors: [{ messageId: 'access' }] }
    ]
});

tester.run('private-constructor-injection', require('..').rules['private-constructor-injection'], {
    valid: [
        'import { Inject as HybridInject } from "@steinringer/angular-ts-decorators"; function factory(HybridInject: any) { class C { constructor(@HybridInject(TOKEN) public service: any) {} } }',
        'import { Component } from "@angular/core"; @Component({}) class C { constructor(private service: Service) {} }',
        'import { Injectable } from "@angular/core"; @Injectable() class C { constructor(private readonly service: Service) {} }',
        'class Model { constructor(public value: string) {} }',
        'import { Component } from "other"; @Component({}) class C { constructor(public value: string) {} }',
        'import { Component, ElementRef } from "@angular/core"; @Component({}) class C { constructor(elementRef: ElementRef) { consume(elementRef.nativeElement); } }',
        'import { Component } from "@angular/core"; @Component({}) class C { constructor(public service: Service) {} }',
        'import { Inject } from "@angular/core"; class C { constructor(@Inject(TOKEN) public service: Service) {} }',
        'import { Component } from "@steinringer/angular-ts-decorators"; @Component({}) class C { constructor(public service: Service) {} }',
        'import { Inject } from "other"; class C { constructor(@Inject(TOKEN) service: Service) {} }',
        'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) private service: Service) {} }',
        'import { Inject as HybridInject } from "@steinringer/angular-ts-decorators"; class C { constructor(@HybridInject(TOKEN) private readonly service: Service) {} }'
    ],
    invalid: [
        { code: 'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) public service: Service) {} }', errors: [{ messageId: 'private' }] },
        { code: 'import { Inject as HybridInject } from "@steinringer/angular-ts-decorators"; class C { constructor(@HybridInject(TOKEN) protected service: Service) {} }', errors: [{ messageId: 'private' }] },
        { code: 'import { Component, Inject } from "@steinringer/angular-ts-decorators"; @Component({}) class C { constructor(@Inject(TOKEN) service: Service) {} }', errors: [{ messageId: 'private' }] },
        { code: 'import { Inject } from "@steinringer/angular-ts-decorators"; class C { constructor(@Inject(TOKEN) readonly service: Service) {} }', errors: [{ messageId: 'private' }] }
    ]
});

tester.run('external-template', require('..').rules['external-template'], {
    valid: [
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component as HybridComponent } from "@steinringer/angular-ts-decorators"; @HybridComponent({templateUrl: "./grid-page.component.html"}) export class GridPageComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component } from "@angular/core"; @Component({templateUrl: "./grid-page.component.html"}) export class GridPageComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component } from "@angular/core"; @Component({templateUrl: "./grid-page.component.html"}) class LocalPageComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/nested/shared.component.ts'),
            code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({templateUrl: "../external-visibility.component.html"}) class SharedComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/nested/legacy-shared.component.ts'),
            code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({templateUrl: "../shared-template.html"}) class SharedComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.ts'),
            code: 'import { Component } from "@angular/core"; @Component({templateUrl: "./grid-page.component.html"}) export class GridPageComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/nested/borrowed.component.ts'),
            code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({templateUrl: "../grid-page.component.html"}) class BorrowedComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/nested/unowned.component.ts'),
            code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({templateUrl: "../unowned-shared.html"}) class UnownedComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component } from "@angular/core"; @Component({"templateUrl": "./grid-page.component.html"}) class QuotedTemplateUrlComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component } from "@angular/core"; @Component({templateUrl: "/app/templates/runtime.html"}) class RuntimeTemplateComponent {}'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component } from "@angular/core"; @Component({templateUrl: "./generated-template.html?version=1"}) class VersionedTemplateComponent {}'
        }
    ],
    invalid: [
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({templateUrl: "./wrong.html"}) export class GridPageComponent {}',
            errors: [{ messageId: 'missing' }]
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component } from "@angular/core"; @Component({templateUrl: "./wrong.html"}) export class GridPageComponent {}',
            errors: [{ messageId: 'missing' }]
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({templateUrl: "./missing.component.html"}) export class GridPageComponent {}',
            errors: [{ messageId: 'missing' }]
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/grid-page.component.ts'),
            code: 'import { Component } from "@angular/core"; @Component({templateUrl: "./wrong.html"}) class LocalPageComponent {}',
            errors: [{ messageId: 'missing' }]
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/missing.component.ts'),
            code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({templateUrl: "./missing.component.html"}) export class MissingComponent {}',
            errors: [{ messageId: 'missing' }]
        },
        {
            filename: path.resolve(__dirname, 'fixtures/App/Packages/Test/pages/testScope/nested/borrowed-missing.component.ts'),
            code: 'import { Component } from "@steinringer/angular-ts-decorators"; @Component({templateUrl: "../shared-template-missing.html"}) class BorrowedMissingComponent {}',
            errors: [{ messageId: 'missing' }]
        }
    ]
});

tester.run('resource-references', require('..').rules['resource-references'], {
    valid: [
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.ts'),
            code: 'import { Localization } from "@steinringer/p2/core/services"; class ExampleService { constructor(private localization: Localization) {} run() { this.localization.get("exampleJS.Welcome", "Ada"); this.localization.get("exampleJS.Saved"); } }'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.component.ts'),
            code: "import { Component } from '@angular/core'; @Component({templateUrl: './resource.component.html'}) class ResourceComponent {}"
        },
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.ts'),
            code: 'import { Localization } from "@steinringer/p2/core/services"; class ExampleService { constructor(private localization: Localization) {} run() { this.localization.get("exampleJS.welcome", "Ada"); this.localization.get("exampleJS.saved"); } }'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.ts'),
            code: 'class ExampleService { constructor(private localization: any) {} run() { this.localization.get("ExampleJS.Welcome"); } }'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.ts'),
            code: 'import { Localization } from "@steinringer/p2/core/services"; class ExampleService { constructor(private localization: Localization) {} run() { this.localization.get("sharedJS.welcome"); } }'
        },
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.component.ts'),
            code: "import { Component } from '@angular/core'; @Component({template: `<p>{{ 'exampleJS.saved' | stLoc }}</p>`}) class ResourceComponent {}"
        },
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.component.ts'),
            code: "import { Component } from '@angular/core'; @Component({template: `<p>{{ 'exampleJS.welcome' | stLoc: person }}</p>`}) class ResourceComponent {}"
        },
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.component.ts'),
            code: "import { Component } from 'other'; @Component({template: `<p>{{ 'exampleJS.Welcome' | stLoc }}</p>`}) class ResourceComponent {}"
        }
    ],
    invalid: [
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.ts'),
            code: 'import { Localization } from "@steinringer/p2/core/services"; class ExampleService { constructor(private localization: Localization) {} run() { this.localization.get("ExampleJS.welcome", "Ada"); } }',
            errors: [{ messageId: 'className' }]
        },
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.ts'),
            code: 'import { Localization } from "@steinringer/p2/core/services"; class ExampleService { constructor(private localization: Localization) {} run() { this.localization.get("exampleJS.welcome"); } }',
            errors: [{ messageId: 'arguments' }]
        },
        {
            filename: path.resolve(__dirname, 'fixtures/Portego.Example.Web/App/Packages/Example/resource.component.ts'),
            code: "import { Component } from '@angular/core'; @Component({template: `<p>{{ 'exampleJS.Welcome' | stLoc }}</p>`}) class ResourceComponent {}",
            errors: [{ messageId: 'arguments' }]
        }
    ]
});

async function run() {
    const webRoot = path.resolve(__dirname, '..');
    const sharedConfig = new ESLint({
        cwd: path.resolve(webRoot, '..'),
        useEslintrc: false,
        overrideConfig: require('../../index')
    });
    for (const filename of ['example.component.ts', 'example.ajs.component.ts', 'example.component.ajs.ts']) {
        const config = await sharedConfig.calculateConfigForFile(filename);
        for (const rule of Object.keys(require('..').rules)) {
            assert.strictEqual(config.rules[`portego/${rule}`][0], 'warn', `${rule} must be enabled for ${filename}`);
        }
        assert.strictEqual(config.rules['@typescript-eslint/member-ordering'][0], 'off');
    }
    const eslint = new ESLint({
        cwd: webRoot,
        useEslintrc: false,
        plugins: {
            portego: require('..')
        },
        overrideConfig: {
            parser: require.resolve('@typescript-eslint/parser'),
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: webRoot,
                sourceType: 'module'
            },
            plugins: ['portego'],
            rules: {
                'portego/hybrid-page-convention': 'warn',
                'portego/role-file-name': 'warn',
                'portego/external-template': 'warn',
                'portego/grid-types': 'warn',
                'portego/notification-catch-shorthand': 'warn',
                'portego/action-callback-name': 'warn',
                'portego/injection-token-name': 'warn',
                'portego/hybrid-template-member-visibility': 'warn',
                'portego/hybrid-page-template': 'warn',
                'portego/st-form-options': 'warn',
                'portego/async-service-await': 'warn',
                'portego/hybrid-inject-token-type': 'warn',
                'portego/hybrid-selector-template-case': 'warn'
            }
        }
    });

    const results = await eslint.lintFiles([
        'tests/fixtures/**/*.component.ts',
        'tests/fixtures/idioms.ts',
        'tests/fixtures/async-wrapper.ts',
        'tests/fixtures/App/Packages/Test/services/webProxy/*.ts',
        'tests/fixtures/action-callback.ts',
        'tests/fixtures/injection-token.ts',
        'tests/fixtures/typed-injection.ts'
    ]);
    const invalid = results.find(result => result.filePath.endsWith(`${path.sep}grid.component.ts`));
    const valid = results.find(result => result.filePath.endsWith(`${path.sep}testScope${path.sep}grid-page.component.ts`));
    const missingScope = results.find(result => result.filePath.endsWith(`${path.sep}pages${path.sep}grid-page.component.ts`));

    assert(invalid, 'Expected the invalid convention fixture to be linted.');
    assert(valid, 'Expected the valid convention fixture to be linted.');
    assert(missingScope, 'Expected the missing scope fixture to be linted.');
    assert.strictEqual(invalid.messages.filter(message => message.ruleId === 'portego/hybrid-page-convention').length, 2);
    assert.strictEqual(invalid.messages.filter(message => message.ruleId === 'portego/role-file-name').length, 1);
    assert.deepStrictEqual(invalid.messages.filter(message => message.ruleId === 'portego/grid-types').map(message => message.messageId), ['options']);
    const anyGrid = results.find(result => result.filePath.endsWith(`${path.sep}any-grid-page.component.ts`));
    assert(anyGrid, 'Expected the explicit any grid fixture to be linted.');
    assert.deepStrictEqual(anyGrid.messages.filter(message => message.ruleId === 'portego/grid-types').map(message => message.messageId), ['options']);
    const sharedGrid = results.find(result => result.filePath.endsWith(`${path.sep}shared-grid.component.ts`));
    assert(sharedGrid, 'Expected the component using a shared grid template to be linted.');
    assert.deepStrictEqual(sharedGrid.messages.filter(message => message.ruleId === 'portego/grid-types').map(message => message.messageId), ['options']);
    const invalidGridStructure = results.find(result => result.filePath.endsWith(`${path.sep}invalid-grid-page.component.ts`));
    assert(invalidGridStructure, 'Expected malformed Portego grid markup in a page to be linted.');
    assert.deepStrictEqual(invalidGridStructure.messages.filter(message => message.ruleId === 'portego/grid-types').map(message => message.messageId), ['structure']);
    const ordinaryGrid = results.find(result => result.filePath.endsWith(`${path.sep}invalid-grid-structure.component.ts`));
    assert(ordinaryGrid, 'Expected the reusable component to be linted.');
    assert.strictEqual(ordinaryGrid.messages.filter(message => message.ruleId === 'portego/grid-types').length, 0);
    const validForm = results.find(result => result.filePath.endsWith(`${path.sep}st-form-page.component.ts`));
    assert(validForm, 'Expected the shared STFormOptions fixture to be linted.');
    assert.strictEqual(validForm.messages.filter(message => message.ruleId === 'portego/st-form-options').length, 0);
    const invalidForm = results.find(result => result.filePath.endsWith(`${path.sep}bad-st-form-page.component.ts`));
    assert(invalidForm, 'Expected the malformed st-form fixture to be linted.');
    assert.deepStrictEqual(invalidForm.messages.filter(message => message.ruleId === 'portego/st-form-options').map(message => message.messageId), ['name', 'type', 'options']);
    const modernForm = results.find(result => result.filePath.endsWith(`${path.sep}modern-st-form.component.ts`));
    assert(modernForm, 'Expected the modern Angular form fixture to be linted.');
    assert.strictEqual(modernForm.messages.filter(message => message.ruleId === 'portego/st-form-options').length, 0);
    const ordinaryForm = results.find(result => result.filePath.endsWith(`${path.sep}ordinary-st-form.component.ts`));
    assert(ordinaryForm, 'Expected the ordinary hybrid form fixture to be linted.');
    assert.deepStrictEqual(ordinaryForm.messages.filter(message => message.ruleId === 'portego/st-form-options').map(message => message.messageId), ['type']);
    const scopedFilename = path.join(webRoot, 'tests/fixtures/App/Packages/Test/pages/testScope/bad-st-form-page.component.ts');
    const boundControls = '<div grid options="$ctrl.options"></div><st-form name="form" options="$ctrl.formOptions"></st-form>';
    const scopedSource = (html, metadata = '', decorator = 'Component') =>
        `import { Component } from '@steinringer/angular-ts-decorators';\n@${decorator}({ selector: 'testBadStFormPage', template: ${JSON.stringify(html)}${metadata} })\nclass ScopedComponent { options: { wrong: string }; formOptions: { wrong: string }; }`;
    const scopeMessages = async code => {
        const [result] = await eslint.lintText(code, { filePath: scopedFilename });
        assert.strictEqual(result.fatalErrorCount, 0);
        return result.messages.filter(message => ['portego/grid-types', 'portego/st-form-options'].includes(message.ruleId));
    };
    assert.deepStrictEqual((await scopeMessages(scopedSource(boundControls))).map(message => message.ruleId).sort(),
        ['portego/grid-types', 'portego/st-form-options']);
    for (const attribute of ['ng-controller="Other as $ctrl"', 'ng-controller="Other"', 'ng-repeat="$ctrl in rows"',
        'ng-repeat="(key, $ctrl) in rows"', 'ng-non-bindable', 'data-ng-non-bindable', 'x-ng-controller="Other as $ctrl"']) {
        assert.strictEqual((await scopeMessages(scopedSource(`<div ${attribute}>${boundControls}</div>`))).length, 0, attribute);
    }
    for (const html of [
        `<div ng-repeat-start="$ctrl in rows"></div>${boundControls}<div ng-repeat-end></div>`,
        `<div ng-repeat="item in rows as $ctrl"></div>${boundControls}`,
        `<div ng-init="$ctrl = other"></div>${boundControls}`
    ])
        assert.strictEqual((await scopeMessages(scopedSource(html))).length, 0, html);
    assert.strictEqual((await scopeMessages(scopedSource(`<div ng-repeat-start="$ctrl in rows"></div>${boundControls}<div ng-repeat-end></div>${boundControls}`))).length, 2,
        'The component owns bindings after the multi-element repeat closes.');
    for (const metadata of [", controllerAs: 'vm'", ', controllerAs: alias', ', ...metadata'])
        assert.strictEqual((await scopeMessages(scopedSource(boundControls, metadata))).length, 0, metadata);
    assert.strictEqual((await scopeMessages(scopedSource(boundControls, ", controllerAs: '$ctrl'"))).length, 2);
    assert.strictEqual((await scopeMessages(scopedSource(boundControls).replace('import { Component }', 'import { Component as Hybrid }').replace('@Component', '@Hybrid'))).length, 2);
    assert.strictEqual((await scopeMessages(`import { Component } from '@steinringer/angular-ts-decorators'; function factory(Component: any) { ${scopedSource(boundControls).split('\n').slice(1).join('\n')} }`)).length, 0,
        'A local decorator named Component is not the hybrid import.');
    const structuralLocations = await scopeMessages(scopedSource('<section grid></section>\n<section grid></section>'));
    assert.strictEqual(structuralLocations.length, 2);
    assert(structuralLocations[0].message.includes('inline template:1:1'));
    assert(structuralLocations[1].message.includes('inline template:2:1'));
    assert.strictEqual(structuralLocations[0].line, structuralLocations[1].line,
        'ESLint anchors stay in TypeScript; HTML positions belong in the messages.');
    const formLocations = await scopeMessages(scopedSource('<st-form></st-form>\n<st-form></st-form>'));
    assert.strictEqual(formLocations.length, 4);
    assert.strictEqual(formLocations.filter(message => message.message.includes('inline template:1:1')).length, 2);
    assert.strictEqual(formLocations.filter(message => message.message.includes('inline template:2:1')).length, 2);
    for (const attribute of ['ng-non-bindable', 'ng-controller="Other as $ctrl"'])
        assert.strictEqual((await scopeMessages(scopedSource(`<div ${attribute}><section grid></section><st-form></st-form></div>`))).length, 0,
            'Do not enforce structure on markup outside this component binding scope.');
    assert(sharedGrid.messages.find(message => message.ruleId === 'portego/grid-types').message.includes('grid-page.component.html:'));
    for (const [attribute, count] of [['ng-attr-title="$ctrl.hidden()"', 0], ['ng-attr-title="{{ $ctrl.hidden() }}"', 1],
        ['data-ng-attr-title="$ctrl.hidden()"', 0], ['title="$ctrl.hidden()"', 0]]) {
        const [result] = await eslint.lintText(`import { Component } from '@steinringer/angular-ts-decorators'; @Component({ template: ${JSON.stringify(`<div ${attribute}></div>`)} }) class VisibilityComponent { private hidden() {} }`,
            { filePath: path.join(webRoot, 'tests/fixtures/App/Packages/Test/pages/testScope/visibility.component.ts') });
        assert.strictEqual(result.messages.filter(message => message.ruleId === 'portego/hybrid-template-member-visibility').length, count, attribute);
    }
    const asyncWrapper = results.find(result => result.filePath.endsWith(`${path.sep}async-wrapper.ts`));
    assert(asyncWrapper, 'Expected the AsyncService.await fixture to be linted.');
    assert.deepStrictEqual(asyncWrapper.messages.filter(message => message.ruleId === 'portego/async-service-await').map(message => message.line), [8, 10]);
    assert.strictEqual(valid.messages.length, 0);
    const orphan = results.find(result => result.filePath.endsWith(`${path.sep}orphan-page.component.ts`));
    assert(orphan, 'Expected the unregistered component fixture to be linted.');
    assert.strictEqual(orphan.messages.filter(message => message.ruleId === 'portego/hybrid-page-convention').length, 0);
    assert.strictEqual(orphan.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').length, 0);
    const differentName = results.find(result => result.filePath.endsWith(`${path.sep}something-page.component.ts`));
    assert(differentName, 'Expected the registered page with an independent selector name to be linted.');
    assert.strictEqual(differentName.messages.filter(message => message.ruleId === 'portego/hybrid-page-convention').length, 0);
    const ordinary = results.find(result => result.filePath.endsWith(`${path.sep}ordinary-hybrid.component.ts`));
    assert(ordinary, 'Expected the registered non-page hybrid component fixture to be linted.');
    assert.deepStrictEqual(ordinary.messages.filter(message => message.ruleId === 'portego/hybrid-page-convention').map(message => message.messageId), ['selector']);
    const pageEvidenceRules = ['portego/hybrid-page-convention', 'portego/hybrid-page-template', 'portego/role-file-name'];
    for (const metadata of [
        "selector: 'testWidget'",
        "selector: 'testGridPage', ...options",
        "selector: 'testGridPage', [key]: 'testWidget'",
        "selector: 'testGridPage', selector: 'testWidget'"
    ]) {
        const [result] = await eslint.lintText(`import { Component as HybridComponent } from '@steinringer/angular-ts-decorators';
            const options = { selector: 'testWidget' }; const key = 'selector';
            @HybridComponent({ ${metadata}, template: '<span>Widget</span>' }) export class OrdinaryComponent {}`,
        { filePath: ordinary.filePath });
        assert(!result.messages.some(message => message.fatal), JSON.stringify(result.messages));
        assert.deepStrictEqual(result.messages.filter(message => pageEvidenceRules.includes(message.ruleId)), [], metadata);
    }
    const [provenPage] = await eslint.lintText(`import { Component as HybridComponent } from '@steinringer/angular-ts-decorators';
        @HybridComponent({ selector: 'testGridPage', template: '<span>Page</span>' }) export class ProvenPageComponent {}`,
    { filePath: ordinary.filePath });
    assert.deepStrictEqual(provenPage.messages.filter(message => pageEvidenceRules.includes(message.ruleId))
        .map(message => message.ruleId).sort(), pageEvidenceRules.slice().sort());
    for (const [file, expected] of [
        ['selector-use.component.ts', 1],
        ['external-selector-use.component.ts', 1],
        ['modern-selector-use.component.ts', 0]
    ]) {
        const result = results.find(item => item.filePath.endsWith(`${path.sep}${file}`));
        assert(result, `Expected ${file} to be linted.`);
        assert.strictEqual(result.messages.filter(message => message.ruleId === 'portego/hybrid-selector-template-case').length, expected);
    }
    const missingShell = results.find(result => result.filePath.endsWith(`${path.sep}missing-shell-page.component.ts`));
    assert(missingShell, 'Expected the registered page without a shell to be linted.');
    assert.deepStrictEqual(missingShell.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').map(message => message.messageId), ['shell']);
    const nestedForm = results.find(result => result.filePath.endsWith(`${path.sep}nested-form-page.component.ts`));
    assert(nestedForm, 'Expected the registered page with a nested form to be linted.');
    assert.deepStrictEqual(nestedForm.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').map(message => message.messageId), ['nestedForm']);
    const badModal = results.find(result => result.filePath.endsWith(`${path.sep}bad-modal-page.component.ts`));
    assert(badModal, 'Expected the registered page with malformed modals to be linted.');
    assert.deepStrictEqual(badModal.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').map(message => message.messageId), ['modal', 'modal']);
    const modalOrder = results.find(result => result.filePath.endsWith(`${path.sep}modal-order-page.component.ts`));
    assert(modalOrder, 'Expected the page with a late modal to be linted.');
    assert.deepStrictEqual(modalOrder.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').map(message => message.messageId), ['order']);
    const conditionalModal = results.find(result => result.filePath.endsWith(`${path.sep}conditional-modal-page.component.ts`));
    assert(conditionalModal, 'Expected the conditional modal page to be linted.');
    assert.strictEqual(conditionalModal.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').length, 0);
    const modalForm = results.find(result => result.filePath.endsWith(`${path.sep}modal-form-page.component.ts`));
    assert(modalForm, 'Expected the page with a handwritten modal form to be linted.');
    assert.deepStrictEqual(modalForm.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').map(message => message.messageId), ['modalForm']);
    const modalFields = results.find(result => result.filePath.endsWith(`${path.sep}modal-fields-page.component.ts`));
    assert(modalFields, 'Expected the page with handwritten modal fields to be linted.');
    assert.deepStrictEqual(modalFields.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').map(message => message.messageId), ['formRow', 'formRow']);
    const validModalFields = results.find(result => result.filePath.endsWith(`${path.sep}valid-modal-fields-page.component.ts`));
    assert(validModalFields, 'Expected the page with form rows to be linted.');
    assert.strictEqual(validModalFields.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').length, 0);
    const modalName = results.find(result => result.filePath.endsWith(`${path.sep}modal-name-page.component.ts`));
    assert(modalName, 'Expected the page with a case-mismatched modal call to be linted.');
    assert.deepStrictEqual(modalName.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').map(message => message.messageId), ['modalName']);
    assert.strictEqual(ordinary.messages.filter(message => message.ruleId === 'portego/hybrid-page-template').length, 0);
    assert.deepStrictEqual(missingScope.messages.map(message => message.messageId), ['placement']);
    const idioms = results.find(result => result.filePath.endsWith(`${path.sep}idioms.ts`));
    assert(idioms, 'Expected the typed notification fixture to be linted.');
    assert.deepStrictEqual(idioms.messages.map(message => [message.ruleId, message.line]), [
        ['portego/notification-catch-shorthand', 4],
        ['portego/notification-catch-shorthand', 5],
        ['portego/notification-catch-shorthand', 6]
    ]);
    const actionCallback = results.find(result => result.filePath.endsWith(`${path.sep}action-callback.ts`));
    assert(actionCallback, 'Expected the action callback fixture to be linted.');
    assert.deepStrictEqual(actionCallback.messages.map(message => [message.ruleId, message.messageId]), [
        ['portego/action-callback-name', 'name']
    ]);
    const injectionToken = results.find(result => result.filePath.endsWith(`${path.sep}injection-token.ts`));
    assert(injectionToken, 'Expected the injection-token fixture to be linted.');
    assert.deepStrictEqual(injectionToken.messages.map(message => [message.ruleId, message.messageId]), [
        ['portego/injection-token-name', 'name'],
        ['portego/injection-token-name', 'name'],
        ['portego/injection-token-name', 'name']
    ]);
    const typedInjection = results.find(result => result.filePath.endsWith(`${path.sep}typed-injection.ts`));
    assert(typedInjection, 'Expected the typed hybrid injection fixture to be linted.');
    assert.deepStrictEqual(typedInjection.messages.filter(message => message.ruleId === 'portego/hybrid-inject-token-type')
        .map(message => message.messageId), ['type', 'type']);
    for (const [file, expected] of [
        ['visibility.component.ts', 3],
        ['external-visibility.component.ts', 1],
        ['shared-visibility.component.ts', 1],
        ['modern-visibility.component.ts', 0]
    ]) {
        const result = results.find(item => item.filePath.endsWith(`${path.sep}${file}`));
        assert(result, `Expected ${file} to be linted.`);
        assert.strictEqual(result.messages.filter(message => message.ruleId === 'portego/hybrid-template-member-visibility').length, expected);
    }
    console.log('Portego ESLint convention tests passed (page/grid, interface names and constructor access).');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
