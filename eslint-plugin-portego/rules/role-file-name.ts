import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { registeredHybridSelectors } from './page-registration';

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            filename: "Name this {{role}} file in kebab-case with the '{{suffix}}' suffix."
        }
    },
    create(context) {
        const filename = path.basename(context.getFilename());
        if (filename.endsWith('.d.ts') || filename.endsWith('.generated.ts'))
            return {};
        const decorators = new Map<string, string>();
        const hybridComponents = new Set<string>();
        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (node.source.value !== '@angular/core'
                    && node.source.value !== '@steinringer/angular-ts-decorators')
                    return;
                for (const specifier of node.specifiers)
                    if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
                        && ['Component', 'Directive', 'Injectable'].includes(specifier.imported.name))
                        decorators.set(specifier.local.name, specifier.imported.name);
                if (node.source.value === '@steinringer/angular-ts-decorators')
                    for (const specifier of node.specifiers)
                        if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
                            && specifier.imported.name === 'Component')
                            hybridComponents.add(specifier.local.name);
            },
            ClassDeclaration(node: TSESTree.ClassDeclaration) {
                if (!node.id)
                    return;
                const roles = new Set((node.decorators || []).flatMap(decorator => {
                    const expression = decorator.expression;
                    if (expression.type !== 'CallExpression' || expression.callee.type !== 'Identifier'
                        || !decorators.has(expression.callee.name))
                        return [];
                    for (let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(expression.callee);
                        scope; scope = scope.upper) {
                        const variable = scope.set.get(expression.callee.name);
                        if (variable)
                            return variable.defs.length === 1 && variable.defs[0].type === 'ImportBinding'
                                ? [decorators.get(expression.callee.name)!] : [];
                    }
                    return [];
                }));
                const role = roles.has('Component') ? 'component'
                    : roles.has('Directive') ? 'directive'
                        : roles.has('Injectable') && node.id.name.endsWith('WebProxy') ? 'web proxy'
                            : roles.has('Injectable') && node.id.name.endsWith('Service') ? 'service' : null;
                if (!role)
                    return;
                const hybrid = node.decorators?.find(decorator => decorator.expression.type === 'CallExpression'
                    && decorator.expression.callee.type === 'Identifier'
                    && hybridComponents.has(decorator.expression.callee.name));
                const metadata = hybrid?.expression.type === 'CallExpression' ? hybrid.expression.arguments[0] : null;
                let registeredPage = false;
                if (metadata?.type === 'ObjectExpression'
                    && !metadata.properties.some(property => property.type === 'SpreadElement' || property.computed)) {
                    const selectors = metadata.properties.filter(property => property.type === 'Property'
                        && !property.computed && ((property.key.type === 'Identifier' && property.key.name === 'selector')
                            || (property.key.type === 'Literal' && property.key.value === 'selector')));
                    const selector = selectors.length === 1 ? selectors[0] : undefined;
                    registeredPage = selector?.type === 'Property' && selector.value.type === 'Literal'
                        && typeof selector.value.value === 'string'
                        && registeredHybridSelectors(context.getFilename()).has(selector.value.value);
                }
                const suffix = registeredPage ? '-page.component.ts' : role === 'web proxy' ? '-web-proxy.service.ts'
                    : role === 'service' ? '.service.ts' : `.${role}.ts`;
                const normalized = filename.replace(/\.ajs(?=\.(?:component|directive|service)\.ts$|\.ts$)/, '');
                const stem = normalized.slice(0, -suffix.length);
                if (!normalized.endsWith(suffix) || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(stem))
                    context.report({ node: node.id, messageId: 'filename', data: { role: registeredPage ? 'page component' : role, suffix } });
            }
        };
    }
} satisfies TSESLint.RuleModule<'filename', []>;
