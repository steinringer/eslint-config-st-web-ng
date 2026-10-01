'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validate } = require('../bin/portego-validate-repository');

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portego-conventions-'));
try {
    fs.mkdirSync(path.join(repoRoot, 'Portego.Example.Jobs'));
    fs.writeFileSync(path.join(repoRoot, 'Portego.Example.Jobs', 'Portego.Example.Jobs.csproj'), '<Project />');
    fs.mkdirSync(path.join(repoRoot, 'Portego.Example.Web'));
    fs.writeFileSync(path.join(repoRoot, 'Portego.Example.Web', 'moduleCfg.js'),
        "module.exports = { name: 'Example', includeProjectAssemblies: ['Portego.Other.Jobs'] };\n");
    fs.mkdirSync(path.join(repoRoot, 'Portego.Other.Web'));
    fs.writeFileSync(path.join(repoRoot, 'Portego.Other.Web', 'moduleCfg.js'),
        "module.exports = { name: 'Other', includeProjectAssemblies: ['Portego.Example.Jobs'] };\n");

    const problems = validate(repoRoot, () => 'Portego.Example.Jobs');
    assert.strictEqual(problems.length, 1, JSON.stringify(problems));
    assert.match(problems[0], /Add 'Portego.Example.Jobs'/);

    fs.writeFileSync(path.join(repoRoot, 'Portego.Example.Web', 'moduleCfg.js'),
        "module.exports = { name: 'Example', includeProjectAssemblies: ['Portego.Example.Jobs'] };\n");
    delete require.cache[require.resolve(path.join(repoRoot, 'Portego.Example.Web', 'moduleCfg.js'))];
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);

    const unresolved = [];
    assert.deepStrictEqual(validate(repoRoot, () => { throw new Error('fixture evaluation failure'); },
        message => unresolved.push(message)), []);
    assert.strictEqual(unresolved.length, 1);
    assert.match(unresolved[0], /Cannot evaluate/);
    fs.writeFileSync(path.join(repoRoot, 'Portego.Example.Web', 'moduleCfg.js'),
        "module.exports = { name: 'Example', includeProjectAssemblies: [] };\n");
    assert.strictEqual(validate(repoRoot, () => 'Portego.Example.Jobs').length, 1);
    fs.writeFileSync(path.join(repoRoot, 'Portego.Example.Web', 'moduleCfg.js'),
        "module.exports = { name: 'Example', includeProjectAssemblies: ['Portego.Example.Jobs'] };\n");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);
    const customLayer = path.join(repoRoot, 'Portego.Example.CustomLayer');
    fs.mkdirSync(customLayer);
    fs.writeFileSync(path.join(customLayer, 'Portego.Example.CustomLayer.csproj'), '<Project />');
    assert.deepStrictEqual(validate(repoRoot, file => file.includes('CustomLayer')
        ? 'Portego.Example.OtherCustomLayer' : 'Portego.Example.Jobs'), []);

    const packageConfig = path.join(repoRoot, 'Portego.Example.Web', 'Configuration', 'Packages', 'Example');
    const packageSource = path.join(repoRoot, 'Portego.Example.Web', 'App', 'Packages', 'Example');
    fs.mkdirSync(packageConfig, { recursive: true });
    fs.mkdirSync(packageSource, { recursive: true });
    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Example/example.module', moduleClassName: 'ExampleModule' }];");
    fs.writeFileSync(path.join(packageSource, 'example.module.ts'),
        "import { NgModule as AngularModule } from '@angular/core'; @AngularModule({}) export class ExampleModule {}");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);

    fs.writeFileSync(path.join(packageConfig, 'tile-injection.tiles.json'),
        JSON.stringify([{ template: '<div testTile></div>', originPackageGuid: 'package-guid' }]));
    fs.writeFileSync(path.join(packageConfig, 'example-package-data.json'),
        JSON.stringify([{ guid: 'package-guid', pages: [] }]));
    fs.writeFileSync(path.join(packageSource, 'tile.component.ts'),
        "import { Component } from '@angular/core'; @Component({ selector: '[testTile]' }) export class TestTile {}");
    fs.writeFileSync(path.join(packageSource, 'example.module.ts'),
        "import { NgModule as AngularModule } from '@angular/core'; @AngularModule({}) export class ExampleModule {}");
    fs.writeFileSync(path.join(packageSource, 'tiles.module.ts'),
        "import { NgModule } from '@angular/core'; import { TestTile } from './tile.component'; @NgModule({ declarations: [TestTile], exports: [TestTile] }) export class TilesModule {}");
    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Example/example.module', moduleClassName: 'ExampleModule' }, { modulePath: '/Packages/Example/tiles.module', moduleClassName: 'TilesModule' }];");
    assert(validate(repoRoot, () => 'Portego.Example.Jobs').some(problem => problem.startsWith('[PTG305]')));

    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Example/example.module', moduleClassName: 'ExampleModule' }, { isTileInjection: true, modulePath: '/Packages/Example/tiles.module', moduleClassName: 'TilesModule' }];");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);
    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Example/example.module', moduleClassName: 'ExampleModule' }, { isTileInjection: runtimeFlag, modulePath: '/Packages/Example/tiles.module', moduleClassName: 'TilesModule' }];");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);
    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Example/example.module', moduleClassName: 'ExampleModule' }, { isTileInjection: true, modulePath: '/Packages/Example/tiles.module', moduleClassName: 'TilesModule' }];");
    fs.writeFileSync(path.join(packageSource, 'tiles.module.ts'),
        "import { NgModule } from '@angular/core'; import { TestTile } from './tile.component'; @NgModule({ declarations: [TestTile], exports: [] }) export class TilesModule {}");
    assert(validate(repoRoot, () => 'Portego.Example.Jobs').some(problem => problem.startsWith('[PTG306]')));
    fs.writeFileSync(path.join(packageSource, 'tiles.module.ts'),
        "import { NgModule } from '@angular/core'; import { TestTile } from './tile.component'; @NgModule({ declarations: [TestTile], exports: [TestTile] }) export class TilesModule {}");
    fs.writeFileSync(path.join(packageConfig, 'tile-injection.tiles.json'),
        JSON.stringify([{ template: '<div testTile></div>', originPackageGuid: 'different-package' }]));
    assert(validate(repoRoot, () => 'Portego.Example.Jobs').some(problem => problem.startsWith('[PTG307]')));
    fs.writeFileSync(path.join(packageConfig, 'tile-injection.tiles.json'),
        JSON.stringify([{ template: '<div testTile></div>', originPackageGuid: 'package-guid' }]));

    fs.writeFileSync(path.join(packageConfig, 'example-package-data.json'),
        JSON.stringify([{ guid: 'package-guid', pages: [{ route: { component: 'ExamplePage', ngComponent: true } }] }]));
    fs.writeFileSync(path.join(packageSource, 'page.component.ts'),
        "import { Component } from '@angular/core'; @Component({ selector: 'example-page' }) export class ExamplePage {}");
    fs.writeFileSync(path.join(packageSource, 'example.module.ts'),
        "import { NgModule } from '@angular/core'; import { ExamplePage } from './page.component'; @NgModule({ declarations: [], exports: [] }) export class ExampleModule {}");
    assert(validate(repoRoot, () => 'Portego.Example.Jobs').some(problem => problem.startsWith('[PTG302]')));
    fs.writeFileSync(path.join(packageSource, 'example.module.ts'),
        "import { NgModule } from '@angular/core'; import { ExamplePage } from './page.component'; @NgModule({ declarations: [ExamplePage], exports: [] }) export class ExampleModule {}");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);

    fs.writeFileSync(path.join(packageSource, 'example-routing.module.ts'),
        "import { NgModule } from '@angular/core'; import { ExamplePage } from './page.component'; const PACKAGE = 'package-guid'; const routes = [{ name: 'example', package: PACKAGE, children: [{ component: ExamplePage, name: 'ExamplePage' }] }]; @NgModule({}) export class ExampleRoutingModule {}");
    fs.writeFileSync(path.join(packageSource, 'example.module.ts'),
        "import { NgModule } from '@angular/core'; import { ExamplePage } from './page.component'; import { ExampleRoutingModule } from './example-routing.module'; @NgModule({ imports: [ExampleRoutingModule], declarations: [ExamplePage], exports: [] }) export class ExampleModule {}");
    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ rootStateName: 'example', modulePath: '/Packages/Example/example.module', moduleClassName: 'ExampleModule' }, { isTileInjection: true, modulePath: '/Packages/Example/tiles.module', moduleClassName: 'TilesModule' }];");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);
    fs.writeFileSync(path.join(packageSource, 'example-routing.module.ts'),
        "import { NgModule } from '@angular/core'; import { ExamplePage } from './page.component'; const PACKAGE = 'package-guid'; const routes = [{ name: 'example', package: PACKAGE, children: [{ component: ExamplePage, name: 'WrongName' }] }]; @NgModule({}) export class ExampleRoutingModule {}");
    assert(validate(repoRoot, () => 'Portego.Example.Jobs').some(problem => problem.startsWith('[PTG304]')));
    fs.writeFileSync(path.join(packageSource, 'example-routing.module.ts'),
        "import { NgModule } from '@angular/core'; import { ExamplePage } from './page.component'; const PACKAGE = 'package-guid'; const routes = [{ name: 'example', package: PACKAGE, children: [{ component: ExamplePage, name: 'ExamplePage' }] }]; @NgModule({}) export class ExampleRoutingModule {}");
    fs.writeFileSync(path.join(packageConfig, 'example-package-data.json'),
        JSON.stringify([{ guid: 'package-guid', pages: [{ route: { component: 'ExamplePage', ngComponent: false } }] }]));
    assert(validate(repoRoot, () => 'Portego.Example.Jobs').some(problem => problem.startsWith('[PTG304]')));
    fs.writeFileSync(path.join(packageConfig, 'example-package-data.json'),
        JSON.stringify([{ guid: 'package-guid', pages: [{ route: { component: 'ExamplePage', ngComponent: true } }] }]));

    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ rootStateName: 'example', modulePath: '/Packages/Example/nested/example.module', moduleClassName: 'ExampleModule' }];");
    const nestedPathProblems = validate(repoRoot, () => 'Portego.Example.Jobs');
    assert(nestedPathProblems.some(problem => problem.startsWith('[PTG303]')));
    assert(!nestedPathProblems.some(problem => problem.startsWith('[PTG302]') || problem.startsWith('[PTG304]')));

    const otherPackageSource = path.join(repoRoot, 'Portego.Example.Web', 'App', 'Packages', 'Other');
    fs.mkdirSync(otherPackageSource, { recursive: true });
    fs.writeFileSync(path.join(otherPackageSource, 'other.module.ts'),
        "import { NgModule } from '@angular/core'; @NgModule({}) export class OtherModule {}");
    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Other/other.module', moduleClassName: 'OtherModule' }];");
    assert(validate(repoRoot, () => 'Portego.Example.Jobs').some(problem => problem.startsWith('[PTG310]')));
    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Other/missing.module', moduleClassName: 'OtherModule' }];");
    assert(!validate(repoRoot, () => 'Portego.Example.Jobs').some(problem => problem.startsWith('[PTG310]')));

    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => { return [{ modulePath: '/Packages/Example/example.module', moduleClassName: 'MissingModule' }]; }; ");
    assert(validate(repoRoot, () => 'Portego.Example.Jobs').some(problem => problem.startsWith('[PTG303]')));

    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Example/example.module', moduleClassName: dynamicName }];");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);
    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Example/missing.module', moduleClassName: 'MissingModule', ...runtimeOverrides }];");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);
    fs.writeFileSync(path.join(packageConfig, 'ng-modules.js'),
        "module.exports = () => [{ modulePath: '/Packages/Example/reexport.module', moduleClassName: 'ExampleModule' }];");
    fs.writeFileSync(path.join(packageSource, 'reexport.module.ts'), "export { ExampleModule } from './example.module';");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);
    fs.writeFileSync(path.join(packageSource, 'reexport.module.ts'),
        "import * as ng from '@angular/core'; @ng.NgModule({}) export class ExampleModule {}");
    assert.deepStrictEqual(validate(repoRoot, () => 'Portego.Example.Jobs'), []);

    const wrongAssembly = validate(repoRoot, () => 'Portego.Other.Jobs');
    assert(wrongAssembly.some(problem => problem.startsWith('[PTG308]')));
} finally {
    if (!repoRoot.startsWith(os.tmpdir() + path.sep))
        throw new Error('Unexpected test directory');
    fs.rmSync(repoRoot, { recursive: true, force: true });
}

console.log('Portego repository convention tests passed.');
