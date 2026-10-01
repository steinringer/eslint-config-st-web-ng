import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

function isPromiseLike(checker: ts.TypeChecker, type: ts.Type, location: ts.Node): boolean {
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
        return false;
    if (type.isUnion())
        return type.types.length > 0 && type.types.every(part => isPromiseLike(checker, part, location));
    const then = checker.getPropertyOfType(type, 'then');
    return !!then && checker.getTypeOfSymbolAtLocation(then, location).getCallSignatures().length > 0;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'problem',
        schema: [],
        messages: {
            floating: 'Await or return this promise started inside AsyncService.await.'
        }
    },
    create(context) {
        const services = context.sourceCode.parserServices;
        if (!services?.program || !services.esTreeNodeToTSNodeMap)
            return {};
        const checker = services.program.getTypeChecker();
        const nodeMap = services.esTreeNodeToTSNodeMap;
        return {
            CallExpression(node: TSESTree.CallExpression) {
                if (node.arguments[0]?.type !== 'ArrowFunctionExpression'
                    && node.arguments[0]?.type !== 'FunctionExpression')
                    return;
                const call = nodeMap.get(node);
                if (!ts.isCallExpression(call))
                    return;
                const method = checker.getResolvedSignature(call)?.declaration;
                if (!method || !ts.isMethodDeclaration(method) || !ts.isIdentifier(method.name)
                    || method.name.text !== 'await' || !ts.isClassDeclaration(method.parent)
                    || method.parent.name?.text !== 'AsyncService'
                    || !/[\\/]Core[\\/]services[\\/]async\.service\.(?:d\.)?ts$/i.test(method.getSourceFile().fileName))
                    return;
                const callback = call.arguments[0];
                if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
                    return;
                // Only direct discarded calls are proven here. Stored promises
                // require flow analysis and are deliberately left to other tools.
                const visit = (statement: ts.Node) => {
                    if (ts.isFunctionLike(statement) || ts.isAwaitExpression(statement)
                        || ts.isReturnStatement(statement) || ts.isVariableDeclaration(statement))
                        return;
                    if (ts.isExpressionStatement(statement)) {
                        const expression = ts.isVoidExpression(statement.expression)
                            ? statement.expression.expression : statement.expression;
                        if (ts.isCallExpression(expression)
                            && isPromiseLike(checker, checker.getTypeAtLocation(expression), expression))
                            context.report({ node: services.tsNodeToESTreeNodeMap!.get(expression), messageId: 'floating' });
                        return;
                    }
                    ts.forEachChild(statement, visit);
                };
                if (ts.isBlock(callback.body))
                    for (const statement of callback.body.statements)
                        visit(statement);
            }
        };
    }
} satisfies TSESLint.RuleModule<'floating', []>;
