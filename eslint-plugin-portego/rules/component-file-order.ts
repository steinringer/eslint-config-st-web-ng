import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

function declaration(node: TSESTree.Statement): TSESTree.Node {
    return node.type === 'ExportNamedDeclaration' && node.declaration ? node.declaration : node;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: { order: 'Order imports, exported constants, the component class, then co-located interfaces.' }
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
            'Program:exit'(program: TSESTree.Program) {
                if (!program.body.some(statement => {
                    const item = declaration(statement);
                    return item.type === 'ClassDeclaration' && item.decorators?.some(decorator =>
                        decorator.expression.type === 'CallExpression'
                        && decorator.expression.callee.type === 'Identifier'
                        && componentNames.has(decorator.expression.callee.name));
                }))
                    return;

                let previousRank = -1;
                for (const statement of program.body) {
                    const item = declaration(statement);
                    let rank = -1;
                    if (statement.type === 'ImportDeclaration')
                        rank = 0;
                    else if (statement.type === 'ExportNamedDeclaration'
                        && item.type === 'VariableDeclaration'
                        && item.kind === 'const')
                        rank = 1;
                    else if (item.type === 'ClassDeclaration' && item.decorators?.some(decorator =>
                        decorator.expression.type === 'CallExpression'
                        && decorator.expression.callee.type === 'Identifier'
                        && componentNames.has(decorator.expression.callee.name)))
                        rank = 2;
                    else if (item.type === 'TSInterfaceDeclaration')
                        rank = 3;

                    if (rank < 0)
                        continue;
                    if (rank < previousRank)
                        context.report({ node: statement, messageId: 'order' });
                    else
                        previousRank = rank;
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'order', []>;
