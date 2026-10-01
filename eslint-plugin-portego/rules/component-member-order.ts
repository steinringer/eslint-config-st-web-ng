import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

function rank(member: TSESTree.ClassElement): number {
    if (member.type === 'PropertyDefinition') {
        if (member.accessibility === 'private')
            return 2;
        if (member.accessibility === 'protected')
            return -1;
        return member.readonly ? 0 : 1;
    }
    if (member.type === 'MethodDefinition') {
        if (member.kind === 'constructor')
            return 3;
        if (member.accessibility === 'private')
            return 5;
        if (member.accessibility === 'protected')
            return -1;
        return 4;
    }
    return -1;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: { order: 'Order component members: public readonly fields, public fields, private fields, constructor, public methods, private methods.' }
    },
    create(context) {
        const componentNames = new Set<string>();
        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (node.source.value !== '@angular/core'
                    && node.source.value !== '@steinringer/angular-ts-decorators')
                    return;
                for (const specifier of node.specifiers) {
                    if (specifier.type === 'ImportSpecifier'
                        && specifier.imported.type === 'Identifier'
                        && specifier.imported.name === 'Component')
                        componentNames.add(specifier.local.name);
                }
            },
            ClassDeclaration(node: TSESTree.ClassDeclaration) {
                if (!node.decorators?.some(decorator => decorator.expression.type === 'CallExpression'
                    && decorator.expression.callee.type === 'Identifier'
                    && componentNames.has(decorator.expression.callee.name)))
                    return;

                let previousRank = -1;
                const reportedRanks = new Set<number>();
                for (const member of node.body.body) {
                    const currentRank = rank(member);
                    if (currentRank < 0)
                        continue;
                    if (currentRank < previousRank && !reportedRanks.has(currentRank)) {
                        context.report({ node: member, messageId: 'order' });
                        reportedRanks.add(currentRank);
                    }
                    previousRank = Math.max(previousRank, currentRank);
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'order', []>;
