import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

function callbackName(node: TSESTree.Node): TSESTree.Identifier | null {
    if (node.type === 'Identifier')
        return node;
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier')
        return node.property;
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
        && !node.callee.computed && node.callee.property.type === 'Identifier'
        && node.callee.property.name === 'bind')
        return callbackName(node.callee.object);
    return null;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            name: "Name callback '{{callback}}' like its registered action '{{action}}'."
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
                if (node.arguments.length < 2 || node.arguments[0].type !== 'Literal'
                    || typeof node.arguments[0].value !== 'string'
                    || !node.arguments[0].value)
                    return;

                const tsNode = nodeMap.get(node);
                if (!ts.isCallExpression(tsNode))
                    return;
                const declaration = checker.getResolvedSignature(tsNode)?.declaration;
                if (!declaration || !ts.isMethodDeclaration(declaration)
                    || !ts.isIdentifier(declaration.name)
                    || declaration.name.text !== 'registerActionCallback'
                    || !ts.isClassDeclaration(declaration.parent)
                    || declaration.parent.name?.text !== 'TitleBarService'
                    || !/[\\/]Core[\\/]services[\\/]title-bar\.service\.(?:d\.)?ts$/i.test(declaration.getSourceFile().fileName))
                    return;

                const callback = callbackName(node.arguments[1]);
                if (!callback || !checker.getSymbolAtLocation(nodeMap.get(callback)))
                    return;
                if (!/^[a-z][A-Za-z0-9]*$/.test(callback.name)
                    || callback.name !== node.arguments[0].value)
                    context.report({ node: callback, messageId: 'name', data: {
                        callback: callback.name, action: node.arguments[0].value
                    } });
            }
        };
    }
} satisfies TSESLint.RuleModule<'name', []>;
