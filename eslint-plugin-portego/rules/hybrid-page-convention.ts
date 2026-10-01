import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

import * as path from 'path';
import * as ts from 'typescript';
import { registeredHybridSelectors } from './page-registration';

const HYBRID_DECORATORS_PACKAGE = '@steinringer/angular-ts-decorators';
const CAMEL_CASE_FOLDER_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const declarationCache = new WeakMap<ts.Program, Map<string, Set<ts.Symbol>>>();

function getProperty(objectExpression: TSESTree.ObjectExpression, propertyName: string) {
    const properties = objectExpression.properties.filter((property): property is TSESTree.Property => property.type === 'Property'
        && !property.computed
        && ((property.key.type === 'Identifier' && property.key.name === propertyName)
            || (property.key.type === 'Literal' && property.key.value === propertyName)));
    return properties.length === 1 ? properties[0] : undefined;
}

function getComponentOptions(classNode: TSESTree.ClassDeclaration, componentNames: ReadonlySet<string>) {
    const decorator = (classNode.decorators || []).find(candidate => candidate.expression.type === 'CallExpression'
        && candidate.expression.callee.type === 'Identifier'
        && componentNames.has(candidate.expression.callee.name));
    const argument = decorator?.expression.type === 'CallExpression' ? decorator.expression.arguments[0] : null;
    return argument?.type === 'ObjectExpression'
        && !argument.properties.some(property => property.type === 'SpreadElement' || property.computed)
        ? argument : null;
}

function declaredHybridComponents(program: ts.Program, packageFolder: string): Set<ts.Symbol> {
    const cached = declarationCache.get(program)?.get(packageFolder);
    if (cached)
        return cached;
    const checker = program.getTypeChecker();
    const declarations = new Set<ts.Symbol>();
    for (const file of program.getSourceFiles()) {
        const filename = file.fileName.replace(/\\/g, '/');
        if (!filename.toLowerCase().startsWith(packageFolder.toLowerCase() + '/')
            || !filename.toLowerCase().endsWith('.ajs.module.ts'))
            continue;

        const moduleDecorators = new Set<string>();
        for (const statement of file.statements) {
            if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
                || statement.moduleSpecifier.text !== HYBRID_DECORATORS_PACKAGE
                || !statement.importClause?.namedBindings
                || !ts.isNamedImports(statement.importClause.namedBindings))
                continue;
            for (const importName of statement.importClause.namedBindings.elements)
                if ((importName.propertyName || importName.name).text === 'NgModule')
                    moduleDecorators.add(importName.name.text);
        }
        for (const statement of file.statements) {
            if (!ts.isClassDeclaration(statement))
                continue;
            for (const decorator of ts.getDecorators(statement) || []) {
                if (!ts.isCallExpression(decorator.expression)
                    || !ts.isIdentifier(decorator.expression.expression)
                    || !moduleDecorators.has(decorator.expression.expression.text)
                    || !ts.isObjectLiteralExpression(decorator.expression.arguments[0]))
                    continue;
                for (const property of decorator.expression.arguments[0].properties) {
                    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)
                        || property.name.text !== 'declarations' || !ts.isArrayLiteralExpression(property.initializer))
                        continue;
                    for (const entry of property.initializer.elements) {
                        if (!ts.isIdentifier(entry))
                            continue;
                        let symbol = checker.getSymbolAtLocation(entry);
                        if (symbol && (symbol.flags & ts.SymbolFlags.Alias))
                            symbol = checker.getAliasedSymbol(symbol);
                        if (symbol)
                            declarations.add(symbol);
                    }
                }
            }
        }
    }
    const packages = declarationCache.get(program) || new Map<string, Set<ts.Symbol>>();
    packages.set(packageFolder, declarations);
    declarationCache.set(program, packages);
    return declarations;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            placement: '[PTG101] Put hybrid page components under App/Packages/<Module>/pages/<camelCaseScope>/.',
            filename: '[PTG101] Name hybrid page files in kebab-case with the -page.component.ts suffix.',
            folder: '[PTG101] Name page scope folders in camelCase.',
            selector: "[PTG101] Prefix this registered hybrid selector with '{{expected}}'."
        }
    },

    create(context) {
        const componentNames = new Set<string>();

        return {
            ImportDeclaration(node) {
                if (node.source.value === HYBRID_DECORATORS_PACKAGE) {
                    for (const specifier of node.specifiers) {
                        if (specifier.type === 'ImportSpecifier'
                            && specifier.imported.type === 'Identifier'
                            && specifier.imported.name === 'Component')
                            componentNames.add(specifier.local.name);
                    }
                }
            },

            'Program:exit'(program: TSESTree.Program) {
                if (componentNames.size === 0)
                    return;

                const filename = path.resolve(context.getFilename()).replace(/\\/g, '/');
                const packageMatch = filename.match(/^(.*)\/App\/Packages\/([^/]+)\/(.+)$/i);
                if (!packageMatch)
                    return;

                const moduleName = packageMatch[2];
                const selectors = registeredHybridSelectors(filename);
                const services = context.sourceCode.parserServices;
                const checker = services?.program?.getTypeChecker();
                const declared = services?.program
                    ? declaredHybridComponents(services.program, `${packageMatch[1]}/App/Packages/${moduleName}`)
                    : new Set<ts.Symbol>();
                const components = program.body
                    .map(statement => statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement)
                    .filter((statement): statement is TSESTree.ClassDeclaration => statement?.type === 'ClassDeclaration'
                        && !!getComponentOptions(statement, componentNames));
                const pageClasses: TSESTree.ClassDeclaration[] = [];
                for (const classNode of components) {
                    const options = getComponentOptions(classNode, componentNames);
                    const selectorProperty = options && getProperty(options, 'selector');
                    if (!selectorProperty || selectorProperty.value.type !== 'Literal'
                        || typeof selectorProperty.value.value !== 'string')
                        continue;
                    const selector = selectorProperty.value.value;
                    const routeRegistered = selectors.has(selector);
                    let symbol = classNode.id && checker && services?.esTreeNodeToTSNodeMap
                        ? checker.getSymbolAtLocation(services.esTreeNodeToTSNodeMap.get(classNode.id)) : null;
                    if (symbol && (symbol.flags & ts.SymbolFlags.Alias))
                        symbol = checker!.getAliasedSymbol(symbol);
                    if (!routeRegistered && (!symbol || !declared.has(symbol)))
                        continue;
                    const expectedSelector = moduleName.charAt(0).toLowerCase() + moduleName.slice(1);
                    if (!(selector.startsWith(expectedSelector)
                        || selector.startsWith('[' + expectedSelector)))
                        context.report({ node: selectorProperty.value, messageId: 'selector', data: { expected: expectedSelector } });
                    if (routeRegistered)
                        pageClasses.push(classNode);
                }
                if (pageClasses.length === 0)
                    return;

                const pagePath = packageMatch[3].match(/^pages\/(.*\/)?([^/]+)$/i);
                if (!pagePath || !pagePath[1])
                    context.report({ node: program, messageId: 'placement' });

                const scopeFolders = (pagePath?.[1] || '').split('/').filter(Boolean);
                for (const folder of scopeFolders) {
                    if (!CAMEL_CASE_FOLDER_PATTERN.test(folder))
                        context.report({ node: program, messageId: 'folder' });
                }

            }
        };
    }
} satisfies TSESLint.RuleModule<'placement' | 'filename' | 'folder' | 'selector', []>;
