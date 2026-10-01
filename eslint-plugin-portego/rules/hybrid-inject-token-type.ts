import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

function symbolAt(checker: ts.TypeChecker, node: ts.Node): ts.Symbol | undefined {
    const symbol = checker.getSymbolAtLocation(node);
    return symbol && (symbol.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(symbol) : symbol;
}

function registeredService(checker: ts.TypeChecker, token: ts.Identifier): ts.ClassDeclaration | null {
    const symbol = symbolAt(checker, token);
    if (!symbol?.declarations?.some(declaration => ts.isVariableDeclaration(declaration)
        && ts.isVariableDeclarationList(declaration.parent)
        && (declaration.parent.flags & ts.NodeFlags.Const) !== 0
        && ts.isVariableStatement(declaration.parent.parent)
        && declaration.parent.parent.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)))
        return null;
    const source = symbol.declarations[0].getSourceFile();
    const injectableNames = new Set<string>();
    for (const statement of source.statements)
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
            && statement.moduleSpecifier.text === '@steinringer/angular-ts-decorators'
            && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings))
            for (const binding of statement.importClause.namedBindings.elements)
                if ((binding.propertyName || binding.name).text === 'Injectable')
                    injectableNames.add(binding.name.text);
    const providers: ts.ClassDeclaration[] = [];
    for (const statement of source.statements) {
        if (!ts.isClassDeclaration(statement) || !statement.name)
            continue;
        if ((ts.getDecorators(statement) || []).some(decorator => ts.isCallExpression(decorator.expression)
            && ts.isIdentifier(decorator.expression.expression)
            && injectableNames.has(decorator.expression.expression.text)
            && decorator.expression.arguments[0]
            && symbolAt(checker, decorator.expression.arguments[0]) === symbol))
            providers.push(statement);
    }
    return providers.length === 1 ? providers[0] : null;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'problem',
        schema: [],
        messages: { type: 'Type this hybrid injection as the service registered by its exported token.' }
    },
    create(context) {
        const services = context.sourceCode.parserServices;
        if (!services?.program || !services.esTreeNodeToTSNodeMap)
            return {};
        const checker = services.program.getTypeChecker();
        const nodeMap = services.esTreeNodeToTSNodeMap;
        const injectNames = new Set<string>();
        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (node.source.value !== '@steinringer/angular-ts-decorators')
                    return;
                for (const specifier of node.specifiers)
                    if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
                        && specifier.imported.name === 'Inject')
                        injectNames.add(specifier.local.name);
            },
            MethodDefinition(node: TSESTree.MethodDefinition) {
                if (node.kind !== 'constructor')
                    return;
                for (const parameter of node.value.params) {
                    const declaration = nodeMap.get(parameter);
                    if (!ts.isParameter(declaration))
                        continue;
                    const decorator = (ts.getDecorators(declaration) || []).find(item =>
                        ts.isCallExpression(item.expression)
                        && ts.isIdentifier(item.expression.expression)
                        && injectNames.has(item.expression.expression.text)
                        && item.expression.arguments[0]
                        && ts.isIdentifier(item.expression.arguments[0]));
                    if (!decorator || !ts.isCallExpression(decorator.expression))
                        continue;
                    const provider = registeredService(checker, decorator.expression.arguments[0] as ts.Identifier);
                    if (!provider?.name)
                        continue;
                    if (!declaration.type) {
                        context.report({ node: parameter, messageId: 'type' });
                        continue;
                    }
                    const type = checker.getTypeFromTypeNode(declaration.type);
                    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
                        context.report({ node: parameter, messageId: 'type' });
                        continue;
                    }
                    const annotationClass = type.getSymbol();
                    if (annotationClass && (annotationClass.flags & ts.SymbolFlags.Class)
                        && annotationClass !== symbolAt(checker, provider.name))
                        context.report({ node: parameter, messageId: 'type' });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'type', []>;
