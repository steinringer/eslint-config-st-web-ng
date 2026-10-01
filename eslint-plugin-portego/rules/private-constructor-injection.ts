import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { collectHybridInjectNames, isHybridInjected } from './hybrid-injection';

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: { private: 'Declare hybrid @Inject constructor parameters as private parameter properties.' }
    },
    create(context) {
        const injectNames = new Set<string>();
        return {
            ImportDeclaration(node) { collectHybridInjectNames(node, injectNames); },
            MethodDefinition(node) {
                if (node.kind !== 'constructor')
                    return;
                for (const parameter of node.value.params) {
                    if (isHybridInjected(parameter, injectNames, context.sourceCode)
                        && (parameter.type !== 'TSParameterProperty' || parameter.accessibility !== 'private'))
                        context.report({ node: parameter, messageId: 'private' });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'private', []>;
