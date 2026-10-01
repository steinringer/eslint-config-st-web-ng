import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

import * as fs from 'fs';
import * as path from 'path';

function getTemplateUrl(classNode: TSESTree.ClassDeclaration, componentNames: ReadonlySet<string>) {
    const decorator = (classNode.decorators || []).find(candidate => candidate.expression.type === 'CallExpression'
        && candidate.expression.callee.type === 'Identifier'
        && componentNames.has(candidate.expression.callee.name));
    const options = decorator?.expression.type === 'CallExpression' ? decorator.expression.arguments[0] : null;
    if (options?.type !== 'ObjectExpression')
        return null;

    const templateUrl = options.properties.find((property): property is TSESTree.Property => property.type === 'Property'
        && !property.computed
        && ((property.key.type === 'Identifier' && property.key.name === 'templateUrl')
            || (property.key.type === 'Literal' && property.key.value === 'templateUrl')));
    return templateUrl?.value.type === 'Literal' && typeof templateUrl.value.value === 'string'
        ? templateUrl.value : null;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            missing: "[PTG103] Template '{{template}}' does not exist."
        }
    },

    create(context) {
        const componentNames = new Set<string>();
        return {
            ImportDeclaration(node) {
                if (node.source.value !== '@steinringer/angular-ts-decorators'
                    && node.source.value !== '@angular/core')
                    return;
                for (const specifier of node.specifiers) {
                    if (specifier.type === 'ImportSpecifier'
                        && specifier.imported.type === 'Identifier'
                        && specifier.imported.name === 'Component')
                        componentNames.add(specifier.local.name);
                }
            },

            'Program:exit'(program: TSESTree.Program) {
                if (componentNames.size === 0)
                    return;

                const componentPath = path.resolve(context.getFilename());
                for (const statement of program.body) {
                    const classNode = statement.type === 'ClassDeclaration' ? statement
                        : (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration')
                            && statement.declaration?.type === 'ClassDeclaration' ? statement.declaration : null;
                    if (!classNode)
                        continue;
                    const templateUrl = getTemplateUrl(classNode, componentNames);
                    if (!templateUrl)
                        continue;

                    const url = templateUrl.value as string;
                    if ((!url.startsWith('./') && !url.startsWith('../'))
                        || path.extname(url).toLowerCase() !== '.html')
                        continue;
                    const templatePath = path.resolve(path.dirname(componentPath), url);
                    if (!fs.existsSync(templatePath) || !fs.statSync(templatePath).isFile())
                        context.report({ node: templateUrl, messageId: 'missing', data: { template: path.basename(templatePath) } });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'missing', []>;
