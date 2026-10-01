import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export function collectHybridInjectNames(node: TSESTree.ImportDeclaration, names: Set<string>) {
    if (node.source.value !== '@steinringer/angular-ts-decorators')
        return;
    for (const specifier of node.specifiers)
        if (specifier.type === 'ImportSpecifier'
            && specifier.imported.type === 'Identifier'
            && specifier.imported.name === 'Inject')
            names.add(specifier.local.name);
}

export function isHybridInjected(parameter: TSESTree.Parameter, names: ReadonlySet<string>, sourceCode: TSESLint.SourceCode) {
    const decorators = [...(parameter.decorators || []), ...(parameter.type === 'TSParameterProperty' ? parameter.parameter.decorators || [] : [])];
    return decorators.some(decorator => {
        if (decorator.expression.type !== 'CallExpression'
            || decorator.expression.callee.type !== 'Identifier'
            || !names.has(decorator.expression.callee.name))
            return false;
        const callee = decorator.expression.callee;
        for (let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(callee); scope; scope = scope?.upper ?? null) {
            const variable = scope.set.get(callee.name);
            if (!variable)
                continue;
            return variable.defs.length === 1 && variable.defs.some(definition =>
                definition.type === 'ImportBinding'
                && definition.node.type === 'ImportSpecifier'
                && definition.node.imported.type === 'Identifier'
                && definition.node.imported.name === 'Inject'
                && definition.parent.type === 'ImportDeclaration'
                && definition.parent.source.value === '@steinringer/angular-ts-decorators');
        }
        return false;
    });
}
