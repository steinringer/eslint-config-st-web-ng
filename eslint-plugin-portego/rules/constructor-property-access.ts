import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { collectHybridInjectNames, isHybridInjected } from './hybrid-injection';

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: { access: "Use 'this.{{name}}' to read the constructor property '{{name}}'." }
    },
    create(context) {
        const injectNames = new Set<string>();
        return {
            ImportDeclaration(node) { collectHybridInjectNames(node, injectNames); },
            'MethodDefinition:exit'(node: TSESTree.MethodDefinition) {
                if (node.kind !== 'constructor' || !node.value.body)
                    return;
                const names = new Set(node.value.params
                    .filter((parameter): parameter is TSESTree.TSParameterProperty => parameter.type === 'TSParameterProperty'
                        && isHybridInjected(parameter, injectNames, context.sourceCode))
                    .map(parameter => parameter.parameter.type === 'AssignmentPattern' ? parameter.parameter.left : parameter.parameter)
                    .filter((parameter): parameter is TSESTree.Identifier => parameter.type === 'Identifier')
                    .map(parameter => parameter.name));
                for (const variable of context.getSourceCode().getDeclaredVariables(node.value)) {
                    if (!names.has(variable.name))
                        continue;
                    for (const reference of variable.references) {
                        const identifier = reference.identifier;
                        if (!reference.isRead() || identifier.range[0] < node.value.body.range[0])
                            continue;
                        let parent: TSESTree.Node | undefined = identifier.parent;
                        while (parent && parent !== node.value.body) {
                            if (parent.type === 'FunctionExpression' || parent.type === 'FunctionDeclaration'
                                || parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression'
                                || (parent.type === 'CallExpression' && parent.callee.type === 'Super'))
                                break;
                            parent = parent.parent;
                        }
                        if (parent === node.value.body)
                            context.report({ node: identifier, messageId: 'access', data: { name: variable.name } });
                    }
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'access', []>;
