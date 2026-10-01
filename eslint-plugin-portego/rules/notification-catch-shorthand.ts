import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

import * as ts from 'typescript';

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: { shorthand: "Pass '{{handler}}' directly to catch instead of wrapping it in a forwarding callback." }
    },
    create(context) {
        const services = context.sourceCode.parserServices;
        if (!services?.program || !services.esTreeNodeToTSNodeMap)
            return {};
        const checker = services.program.getTypeChecker();
        return {
            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression' || node.callee.computed
                    || node.callee.property.name !== 'catch' || node.arguments.length !== 1)
                    return;
                const catchSymbol = checker.getSymbolAtLocation(services.esTreeNodeToTSNodeMap!.get(node.callee.property));
                // Require the standard Promise member, not a lookalike catch API.
                if (!catchSymbol?.declarations?.length || !catchSymbol.declarations.every(declaration =>
                    ts.isMethodSignature(declaration)
                    && ts.isInterfaceDeclaration(declaration.parent)
                    && declaration.parent.name.text === 'Promise'
                    && services.program!.isSourceFileDefaultLibrary(declaration.getSourceFile())))
                    return;
                const callback = node.arguments[0];
                if (callback.type !== 'ArrowFunctionExpression' || callback.async || callback.params.length !== 1
                    || callback.params[0].type !== 'Identifier')
                    return;
                let body: TSESTree.Node | null = callback.body;
                if (body.type === 'BlockStatement') {
                    if (body.body.length !== 1)
                        return;
                    const statement = body.body[0];
                    body = statement.type === 'ReturnStatement' ? statement.argument
                        : statement.type === 'ExpressionStatement' ? statement.expression : null;
                }
                if (body?.type !== 'CallExpression' || body.optional || body.arguments.length !== 1
                    || body.arguments[0].type !== 'Identifier' || body.arguments[0].name !== callback.params[0].name
                    || body.callee.type !== 'MemberExpression' || body.callee.computed || body.callee.optional
                    || body.callee.property.name !== 'processFailure')
                    return;
                const symbol = checker.getSymbolAtLocation(services.esTreeNodeToTSNodeMap!.get(body.callee.property));
                if (body.callee.object.type === 'Identifier' && body.callee.object.name === callback.params[0].name)
                    return;
                const declaration = symbol?.declarations?.find(candidate => ts.isPropertyDeclaration(candidate)
                    && candidate.parent.name?.text === 'InstantNotification'
                    && candidate.getSourceFile().fileName.replace(/\\/g, '/').endsWith('/Core/services/instant-notification.service.ts')
                    && candidate.initializer && ts.isArrowFunction(candidate.initializer));
                if (declaration)
                    context.report({ node: callback, messageId: 'shorthand', data: { handler: context.getSourceCode().getText(body.callee) } });
            }
        };
    }
} satisfies TSESLint.RuleModule<'shorthand', []>;
