#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ts = require('typescript');

function getAssemblyName(projectPath) {
    const name = execFileSync('dotnet', ['msbuild', projectPath, '-getProperty:AssemblyName', '-nologo'], {
        encoding: 'utf8'
    }).trim();
    if (!name || name.includes('\n'))
        throw new Error(`Could not evaluate AssemblyName for ${projectPath}`);
    return name;
}

function staticNgModules(file) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const assignment = source.statements.find(statement => ts.isExpressionStatement(statement)
        && ts.isBinaryExpression(statement.expression)
        && statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && statement.expression.left.getText(source) === 'module.exports');
    if (!assignment)
        return [];
    const exported = assignment.expression.right;
    const result = ts.isArrowFunction(exported) || ts.isFunctionExpression(exported)
        ? ts.isBlock(exported.body)
            ? exported.body.statements.find(ts.isReturnStatement)?.expression
            : exported.body
        : exported;
    if (!result || !ts.isArrayLiteralExpression(result))
        return [];
    return result.elements.filter(ts.isObjectLiteralExpression)
        .filter(entry => entry.properties.every(ts.isPropertyAssignment)).map(entry => {
        const field = name => entry.properties.find(property => ts.isPropertyAssignment(property)
            && property.name.getText(source) === name);
        const modulePath = field('modulePath');
        const moduleClassName = field('moduleClassName');
        const rootStateName = field('rootStateName');
        const tileFlag = field('isTileInjection');
        return {
            modulePath: modulePath && ts.isStringLiteralLike(modulePath.initializer) ? modulePath.initializer.text : null,
            moduleClassName: moduleClassName && ts.isStringLiteralLike(moduleClassName.initializer)
                ? moduleClassName.initializer.text : null,
            rootStateName: rootStateName && ts.isStringLiteralLike(rootStateName.initializer)
                ? rootStateName.initializer.text : null,
            isTileInjection: !tileFlag ? false
                : tileFlag.initializer.kind === ts.SyntaxKind.TrueKeyword ? true
                    : tileFlag.initializer.kind === ts.SyntaxKind.FalseKeyword ? false : null
        };
    });
}

function literalArrayField(object, name) {
    const field = object.properties.find(property => ts.isPropertyAssignment(property)
        && property.name.getText() === name);
    return field && ts.isArrayLiteralExpression(field.initializer) ? field.initializer.elements : null;
}

function angularModuleInfo(file, className) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const moduleClass = source.statements.find(statement => ts.isClassDeclaration(statement)
        && statement.name?.text === className);
    const decorator = moduleClass && (ts.getDecorators(moduleClass) || []).find(item =>
        ts.isCallExpression(item.expression) && item.expression.expression.getText(source) === 'NgModule');
    const metadata = decorator?.expression.arguments[0];
    if (!metadata || !ts.isObjectLiteralExpression(metadata))
        return null;
    const declarations = literalArrayField(metadata, 'declarations');
    const exports = literalArrayField(metadata, 'exports');
    const moduleImports = literalArrayField(metadata, 'imports');
    if (!declarations || !exports)
        return null;
    const imported = new Map();
    for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
            || !statement.moduleSpecifier.text.startsWith('.')
            || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings))
            continue;
        for (const binding of statement.importClause.namedBindings.elements)
            imported.set(binding.name.text, path.resolve(path.dirname(file), statement.moduleSpecifier.text + '.ts'));
    }
    return {
        imports: imported,
        moduleImports: new Set((moduleImports || []).filter(ts.isIdentifier).map(item => item.text)),
        declarations: new Set(declarations.filter(ts.isIdentifier).map(item => item.text)),
        exports: new Set(exports.filter(ts.isIdentifier).map(item => item.text))
    };
}

function angularSelector(file, className) {
    if (!fs.existsSync(file))
        return null;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const angularComponent = source.statements.some(statement => ts.isImportDeclaration(statement)
        && ts.isStringLiteral(statement.moduleSpecifier)
        && statement.moduleSpecifier.text === '@angular/core'
        && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
        && statement.importClause.namedBindings.elements.some(binding => (binding.propertyName || binding.name).text === 'Component'
            && binding.name.text === 'Component'));
    if (!angularComponent)
        return null;
    const component = source.statements.find(statement => ts.isClassDeclaration(statement)
        && statement.name?.text === className);
    const decorator = component && (ts.getDecorators(component) || []).find(item =>
        ts.isCallExpression(item.expression) && item.expression.expression.getText(source) === 'Component');
    const metadata = decorator?.expression.arguments[0];
    if (!metadata || !ts.isObjectLiteralExpression(metadata))
        return null;
    const selector = metadata.properties.find(property => ts.isPropertyAssignment(property)
        && property.name.getText(source) === 'selector');
    return selector && ts.isStringLiteralLike(selector.initializer) ? selector.initializer.text : null;
}

function templateUsesSelector(template, selector) {
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(selector.replace(/^\[|\]$/g, '')))
        return false;
    const name = selector.replace(/^\[|\]$/g, '');
    return selector.startsWith('[')
        ? new RegExp(`<[^>]+\\s${name}(?:\\s|=|>)`, 'i').test(template)
        : new RegExp(`<${name}(?:\\s|>)`, 'i').test(template);
}

function registeredModuleFile(packageConfig, packageRoot, entry) {
    const prefix = `/Packages/${path.basename(packageConfig)}/`;
    if (!entry.modulePath?.startsWith(prefix) || !entry.moduleClassName)
        return null;
    const file = path.resolve(packageRoot, entry.modulePath.slice(prefix.length) + '.ts');
    return file.startsWith(path.resolve(packageRoot) + path.sep) && fs.existsSync(file) ? file : null;
}

function validateTileInjection(packageConfig, packageRoot, entries) {
    const file = path.join(packageConfig, 'tile-injection.tiles.json');
    if (!fs.existsSync(file))
        return [];
    let tiles;
    try {
        tiles = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
        return [];
    }
    if (!Array.isArray(tiles))
        return [];
    const packageGuids = new Set();
    for (const name of fs.readdirSync(packageConfig)) {
        if (!/(?:\.data|-data)\.json$/i.test(name))
            continue;
        try {
            const data = JSON.parse(fs.readFileSync(path.join(packageConfig, name), 'utf8').replace(/^\uFEFF/, ''));
            if (Array.isArray(data))
                for (const item of data)
                    if (typeof item.guid === 'string')
                        packageGuids.add(item.guid.toLowerCase());
        } catch {
            // Dynamic or malformed package metadata is incomplete evidence.
        }
    }
    const modules = entries.flatMap(entry => {
        const moduleFile = registeredModuleFile(packageConfig, packageRoot, entry);
        if (!moduleFile)
            return [];
        const info = angularModuleInfo(moduleFile, entry.moduleClassName);
        return info ? [{ entry, info }] : [];
    });
    const problems = [];
    for (const tile of tiles) {
        if (typeof tile.template !== 'string')
            continue;
        const matches = modules.flatMap(module => [...module.info.imports].flatMap(([name, importedFile]) => {
            const selector = angularSelector(importedFile, name);
            return selector && templateUsesSelector(tile.template, selector) ? [{ module, name }] : [];
        }));
        if (matches.length !== 1)
            continue;
        const { module, name } = matches[0];
        if (packageGuids.size && (typeof tile.originPackageGuid !== 'string'
            || !packageGuids.has(tile.originPackageGuid.toLowerCase())))
            problems.push(`[PTG307] ${file} has an injected Angular tile whose originPackageGuid does not match this package.`);
        if (module.entry.isTileInjection === false)
            problems.push(`[PTG305] ${file} uses ${name}, but its ng-modules.js entry is not marked isTileInjection: true.`);
        if (!module.info.declarations.has(name) || !module.info.exports.has(name))
            problems.push(`[PTG306] ${name} in ${file} must be declared and exported by ${module.entry.moduleClassName}.`);
    }
    return problems;
}

function validateLazyComponents(packageConfig, packageRoot, entries) {
    const components = new Set();
    for (const name of fs.readdirSync(packageConfig)) {
        if (!/(?:\.data|-data)\.json$/i.test(name))
            continue;
        try {
            const data = JSON.parse(fs.readFileSync(path.join(packageConfig, name), 'utf8').replace(/^\uFEFF/, ''));
            if (Array.isArray(data))
                for (const item of data)
                    if (Array.isArray(item.pages))
                        for (const page of item.pages)
                            if (page.route?.ngComponent === true && typeof page.route.component === 'string')
                                components.add(page.route.component);
        } catch {
            // Dynamic or malformed package data does not establish component ownership.
        }
    }
    const modules = entries.flatMap(entry => {
        const file = registeredModuleFile(packageConfig, packageRoot, entry);
        if (!file)
            return [];
        const info = angularModuleInfo(file, entry.moduleClassName);
        return info ? [{ entry, info }] : [];
    });
    const problems = [];
    for (const component of components) {
        const owners = modules.filter(module => {
            const file = module.info.imports.get(component);
            return file && angularSelector(file, component);
        });
        if (owners.length === 1 && !owners[0].info.declarations.has(component))
            problems.push(`[PTG302] ${component} is an Angular page in ${packageConfig} but is not declared by ${owners[0].entry.moduleClassName}.`);
    }
    return problems;
}

function staticRoutes(file, rootName) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const constants = new Map();
    for (const statement of source.statements)
        if (ts.isVariableStatement(statement))
            for (const declaration of statement.declarationList.declarations)
                if (ts.isIdentifier(declaration.name) && declaration.initializer
                    && ts.isStringLiteralLike(declaration.initializer))
                    constants.set(declaration.name.text, declaration.initializer.text);
    const field = (object, name) => object.properties.find(property => ts.isPropertyAssignment(property)
        && property.name.getText(source) === name);
    const value = property => property && ts.isPropertyAssignment(property)
        && ts.isStringLiteralLike(property.initializer) ? property.initializer.text : null;
    for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement))
            continue;
        for (const declaration of statement.declarationList.declarations) {
            if (!declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer))
                continue;
            for (const root of declaration.initializer.elements) {
                if (!ts.isObjectLiteralExpression(root) || value(field(root, 'name')) !== rootName)
                    continue;
                const packageField = field(root, 'package');
                const packageGuid = value(packageField) || (packageField && ts.isPropertyAssignment(packageField)
                    && ts.isIdentifier(packageField.initializer) ? constants.get(packageField.initializer.text) : null);
                const children = field(root, 'children');
                if (!packageGuid || !children || !ts.isPropertyAssignment(children)
                    || !ts.isArrayLiteralExpression(children.initializer))
                    continue;
                return {
                    packageGuid,
                    states: children.initializer.elements.filter(ts.isObjectLiteralExpression).flatMap(child => {
                        const component = field(child, 'component');
                        const name = value(field(child, 'name'));
                        return component && ts.isPropertyAssignment(component)
                            && ts.isIdentifier(component.initializer) && name
                            ? [{ component: component.initializer.text, name }] : [];
                    })
                };
            }
        }
    }
    return null;
}

function validateLazyRoutes(packageConfig, packageRoot, entries) {
    const pages = [];
    for (const name of fs.readdirSync(packageConfig)) {
        if (!/(?:\.data|-data)\.json$/i.test(name))
            continue;
        try {
            const data = JSON.parse(fs.readFileSync(path.join(packageConfig, name), 'utf8').replace(/^\uFEFF/, ''));
            if (Array.isArray(data))
                for (const item of data)
                    if (typeof item.guid === 'string' && Array.isArray(item.pages))
                        for (const page of item.pages)
                            if (typeof page.route?.component === 'string')
                                pages.push({ packageGuid: item.guid, route: page.route });
        } catch {
            // Unresolved package data is not route evidence.
        }
    }
    const problems = [];
    for (const entry of entries) {
        const file = registeredModuleFile(packageConfig, packageRoot, entry);
        if (!entry.rootStateName || !file)
            continue;
        const info = angularModuleInfo(file, entry.moduleClassName);
        if (!info)
            continue;
        const routing = [...info.imports].filter(([name, importedFile]) =>
            info.moduleImports.has(name) && /-routing\.module\.ts$/i.test(importedFile)
            && fs.existsSync(importedFile) && hasAngularModule(importedFile, name));
        if (routing.length !== 1)
            continue;
        const routes = staticRoutes(routing[0][1], entry.rootStateName);
        if (!routes)
            continue;
        for (const state of routes.states) {
            const matches = pages.filter(page => page.route.component === state.component
                || page.route.component === state.name);
            if (matches.length !== 1)
                continue;
            const page = matches[0];
            if (page.route.component !== state.name || page.route.ngComponent !== true
                || page.packageGuid.toLowerCase() !== routes.packageGuid.toLowerCase())
                problems.push(`[PTG304] ${page.route.component} in ${packageConfig} does not match its resolved Angular route name, package GUID, or ngComponent flag.`);
        }
    }
    return problems;
}

function hasAngularModule(file, className) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const names = new Set();
    for (const statement of source.statements)
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
            && statement.moduleSpecifier.text === '@angular/core'
            && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings))
            for (const binding of statement.importClause.namedBindings.elements)
                if ((binding.propertyName || binding.name).text === 'NgModule')
                    names.add(binding.name.text);
    const found = source.statements.some(statement => ts.isClassDeclaration(statement)
        && statement.name?.text === className
        && (ts.getDecorators(statement) || []).some(decorator => ts.isCallExpression(decorator.expression)
            && ts.isIdentifier(decorator.expression.expression)
            && names.has(decorator.expression.expression.text)));
    if (found)
        return true;
    // Re-exports, namespace imports and helper decorators need symbol resolution.
    if (source.statements.some(statement => ts.isExportDeclaration(statement)
        || (ts.isClassDeclaration(statement) && statement.name?.text === className
            && (ts.getDecorators(statement) || []).length)))
        return null;
    return false;
}

function validateNgModules(webRoot) {
    const problems = [];
    const packages = path.join(webRoot, 'Configuration', 'Packages');
    if (!fs.existsSync(packages))
        return problems;
    for (const entry of fs.readdirSync(packages, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const registration = path.join(packages, entry.name, 'ng-modules.js');
        if (!fs.existsSync(registration))
            continue;
        const registrations = staticNgModules(registration);
        for (const item of registrations) {
            if (item.modulePath?.startsWith('/Packages/') && item.moduleClassName
                && !item.modulePath.startsWith(`/Packages/${entry.name}/`)) {
                const registeredFile = path.resolve(webRoot, 'App', item.modulePath.slice(1) + '.ts');
                const packagesRoot = path.resolve(webRoot, 'App', 'Packages') + path.sep;
                if (registeredFile.startsWith(packagesRoot) && fs.existsSync(registeredFile)
                    && hasAngularModule(registeredFile, item.moduleClassName))
                    problems.push(`[PTG310] ${registration} registers ${item.moduleClassName} from ${item.modulePath}; this package's entry file belongs under App/Packages/${entry.name}/.`);
            }
            if (!item.modulePath || !item.moduleClassName
                || !item.modulePath.replace(/\\/g, '/').startsWith(`/Packages/${entry.name}/`))
                continue;
            const packageRoot = path.resolve(webRoot, 'App', 'Packages', entry.name);
            const file = path.resolve(webRoot, 'App', item.modulePath.slice(1) + '.ts');
            if (!file.startsWith(packageRoot + path.sep))
                continue;
            if (!fs.existsSync(file) || hasAngularModule(file, item.moduleClassName) === false)
                problems.push(`[PTG303] ${registration} points to ${item.moduleClassName} in ${item.modulePath}, but that Angular NgModule was not found.`);
        }
        problems.push(...validateTileInjection(path.join(packages, entry.name),
            path.join(webRoot, 'App', 'Packages', entry.name), registrations));
        problems.push(...validateLazyComponents(path.join(packages, entry.name),
            path.join(webRoot, 'App', 'Packages', entry.name), registrations));
        problems.push(...validateLazyRoutes(path.join(packages, entry.name),
            path.join(webRoot, 'App', 'Packages', entry.name), registrations));
    }
    return problems;
}

function validate(repoRoot, evaluateAssemblyName = getAssemblyName, reportUnresolved = () => {}) {
    const entries = fs.readdirSync(repoRoot, { withFileTypes: true }).filter(entry => entry.isDirectory());
    const configs = [];
    const problems = [];

    for (const entry of entries) {
        const configPath = path.join(repoRoot, entry.name, 'moduleCfg.js');
        if (!fs.existsSync(configPath))
            continue;
        problems.push(...validateNgModules(path.join(repoRoot, entry.name)));
        try {
            delete require.cache[require.resolve(configPath)];
            const config = require(configPath);
            if (typeof config.name === 'string' && Array.isArray(config.includeProjectAssemblies))
                configs.push(config);
        } catch (error) {
            reportUnresolved(`Cannot read ${configPath}: ${error.message}`);
        }
    }

    for (const entry of entries) {
        const projectPath = path.join(repoRoot, entry.name, `${entry.name}.csproj`);
        if (!fs.existsSync(projectPath))
            continue;

        try {
            const assembly = evaluateAssemblyName(projectPath);
            const directoryOwners = configs.filter(config => entry.name.startsWith(`Portego.${config.name}.`));
            if (directoryOwners.length === 1) {
                const prefix = `Portego.${directoryOwners[0].name}.`;
                if (!assembly.startsWith(prefix) || assembly.length === prefix.length)
                    problems.push(`[PTG308] ${projectPath} has assembly '${assembly}', not a layer under ${prefix}`);
            }

            if (!entry.name.endsWith('.Jobs'))
                continue;
            if (!assembly.endsWith('.Jobs')) {
                problems.push(`[PTG301] ${projectPath} evaluates to '${assembly}', which does not end in .Jobs.`);
                continue;
            }
            const moduleName = assembly.slice('Portego.'.length, -'.Jobs'.length);
            const owners = configs.filter(config => config.name === moduleName);
            if (owners.length !== 1) {
                reportUnresolved(`Cannot determine the moduleCfg.js owner for ${assembly}; found ${owners.length}.`);
            } else if (!owners[0].includeProjectAssemblies.includes(assembly)) {
                problems.push(`[PTG301] Add '${assembly}' to its moduleCfg.js includeProjectAssemblies list.`);
            }
        } catch (error) {
            reportUnresolved(`Cannot evaluate ${projectPath}: ${error.message}`);
        }
    }

    return problems;
}

if (require.main === module) {
    const cwd = process.cwd();
    const repoRoot = path.basename(cwd).endsWith('.Web') ? path.dirname(cwd) : cwd;
    const unresolved = [];
    const problems = validate(repoRoot, getAssemblyName, message => unresolved.push(message));
    for (const message of unresolved)
        console.warn(`[unresolved] ${message}`);
    for (const problem of problems)
        console.warn(problem);
    if (process.argv.includes('--strict'))
        process.exitCode = unresolved.length ? 2 : problems.length ? 1 : 0;
}

module.exports = { validate };
