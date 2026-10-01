import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: { name: "Name exported injection token '{{name}}' in UPPER_SNAKE_CASE." }
    },
    create(context) {
        const services = context.sourceCode.parserServices;
        if (!services?.program || !services.esTreeNodeToTSNodeMap)
            return {};

        const checker = services.program.getTypeChecker();
        const nodeMap = services.esTreeNodeToTSNodeMap;
        const hybridInjectNames = new Set<string>();
        const providerDecoratorNames = new Set<string>();
        const reported = new Set<ts.Symbol>();
        function checkToken(token: TSESTree.Identifier) {
            let symbol = checker.getSymbolAtLocation(nodeMap.get(token));
            if (!symbol)
                return;
            if (symbol.flags & ts.SymbolFlags.Alias)
                symbol = checker.getAliasedSymbol(symbol);
            if (!symbol.declarations?.some(declaration => ts.isVariableDeclaration(declaration)
                && ts.isVariableDeclarationList(declaration.parent)
                && (declaration.parent.flags & ts.NodeFlags.Const) !== 0
                && ts.isVariableStatement(declaration.parent.parent)
                && declaration.parent.parent.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)))
                return;

            if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(symbol.name) && !reported.has(symbol)) {
                reported.add(symbol);
                context.report({ node: token, messageId: 'name', data: { name: symbol.name } });
            }
        }
        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (node.source.value !== '@steinringer/angular-ts-decorators'
                    && node.source.value !== '@angular/core')
                    return;
                for (const specifier of node.specifiers) {
                    if (specifier.type === 'ImportSpecifier'
                        && specifier.imported.type === 'Identifier'
                        && specifier.imported.name === 'Inject'
                        && node.source.value === '@steinringer/angular-ts-decorators')
                        hybridInjectNames.add(specifier.local.name);
                    if (specifier.type === 'ImportSpecifier'
                        && specifier.imported.type === 'Identifier'
                        && (specifier.imported.name === 'NgModule' || specifier.imported.name === 'Component')
                        && (node.source.value === '@angular/core'
                            || node.source.value === '@steinringer/angular-ts-decorators'))
                        providerDecoratorNames.add(specifier.local.name);
                }
            },
            Decorator(node: TSESTree.Decorator) {
                if (node.expression.type !== 'CallExpression'
                    || node.expression.callee.type !== 'Identifier'
                    || !hybridInjectNames.has(node.expression.callee.name)
                    || node.expression.arguments[0]?.type !== 'Identifier')
                    return;

                checkToken(node.expression.arguments[0]);
            },
            ClassDeclaration(node: TSESTree.ClassDeclaration) {
                for (const decorator of node.decorators || []) {
                    if (decorator.expression.type !== 'CallExpression'
                        || decorator.expression.callee.type !== 'Identifier'
                        || !providerDecoratorNames.has(decorator.expression.callee.name)
                        || decorator.expression.arguments[0]?.type !== 'ObjectExpression')
                        continue;

                    for (const property of decorator.expression.arguments[0].properties) {
                        if (property.type !== 'Property' || property.key.type !== 'Identifier'
                            || property.key.name !== 'providers' || property.value.type !== 'ArrayExpression')
                            continue;
                        for (const provider of property.value.elements) {
                            if (provider?.type !== 'ObjectExpression')
                                continue;
                            for (const field of provider.properties) {
                                if (field.type === 'Property' && field.key.type === 'Identifier'
                                    && field.key.name === 'provide' && field.value.type === 'Identifier')
                                    checkToken(field.value);
                            }
                        }
                    }
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'name', []>;
