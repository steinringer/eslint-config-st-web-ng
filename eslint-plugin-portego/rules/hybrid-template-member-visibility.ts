import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { parseFragment } from 'parse5';
import * as ts from 'typescript';
import { readRelativeHtmlTemplate } from './template-file';

type HtmlNode = {
    nodeName: string;
    value?: string;
    attrs?: { name: string; value: string }[];
    childNodes?: HtmlNode[];
};

function findPrivateMembers(html: string, type: ts.Type): string[] {
    const names = new Set<string>();
    const normalizedName = (name: string) => name.replace(/^(?:data-|x-)/, '').replace(/[:_]/g, '-');
    const fragment = parseFragment(html) as HtmlNode;
    const rebindsParent = (node: HtmlNode): boolean => !!node.attrs?.some(attribute =>
        (/^ng-repeat(?:-start)?$/.test(normalizedName(attribute.name)) && /\bas\s+\$ctrl\b/.test(attribute.value))
        || (normalizedName(attribute.name) === 'ng-init' && /\$ctrl\s*=(?!=)/.test(attribute.value)))
        || !!node.childNodes?.some(rebindsParent);
    // These assignments may change sibling bindings as well as this subtree.
    if (rebindsParent(fragment))
        return [];
    const inspect = (value: string) => {
        const source = ts.createSourceFile('template-expression.ts', `(${value.replace(/^\s*::/, '')});`,
            ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        if ((source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length)
            return;
        const visitExpression = (node: ts.Node) => {
            if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)
                && node.expression.text === '$ctrl') {
                const symbol = type.getProperty(node.name.text);
                if (symbol?.declarations?.some(declaration => ts.canHaveModifiers(declaration)
                    && ts.getModifiers(declaration)?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword
                        || modifier.kind === ts.SyntaxKind.ProtectedKeyword)))
                    names.add(node.name.text);
            }
            ts.forEachChild(node, visitExpression);
        };
        ts.forEachChild(source, visitExpression);
    };
    const visit = (node: HtmlNode) => {
        // These subtrees do not bind $ctrl to this component.
        if (node.attrs?.some(attribute => {
            const name = normalizedName(attribute.name);
            return name === 'ng-non-bindable'
                || (name === 'ng-repeat' && /\$ctrl\b/.test(attribute.value.split(/\s+in\s+/)[0]))
                || (name === 'ng-controller' && /\bas\s+\$ctrl\b/.test(attribute.value))
                || (name === 'ng-init' && /\$ctrl\s*=/.test(attribute.value));
        }))
            return;
        if (node.nodeName === '#text' && node.value) {
            for (const interpolation of node.value.matchAll(/\{\{([\s\S]*?)\}\}/g))
                inspect(interpolation[1]);
        }
        for (const attribute of node.attrs || []) {
            if (/^(?:ng-|\[|\(|\*|on-|\:)/.test(attribute.name)
                && !normalizedName(attribute.name).startsWith('ng-attr-')
                && !attribute.value.includes('{{'))
                inspect(attribute.value);
            for (const interpolation of attribute.value.matchAll(/\{\{([\s\S]*?)\}\}/g))
                inspect(interpolation[1]);
        }
        const repeatScopes: boolean[] = [];
        for (const child of node.childNodes || []) {
            const repeat = child.attrs?.find(attribute => normalizedName(attribute.name) === 'ng-repeat-start');
            if (repeat)
                repeatScopes.push(/\$ctrl\b/.test(repeat.value.split(/\s+in\s+/)[0]));
            if (!repeatScopes.some(Boolean))
                visit(child);
            if (child.attrs?.some(attribute => normalizedName(attribute.name) === 'ng-repeat-end'))
                repeatScopes.pop();
        }
    };
    visit(fragment);
    return [...names];
}

export = {
    defaultOptions: [],
    meta: {
        type: 'problem',
        schema: [],
        messages: { visibility: "Make '{{member}}' public if the hybrid template uses it through $ctrl." }
    },
    create(context) {
        const services = context.sourceCode.parserServices;
        if (!services?.program || !services.esTreeNodeToTSNodeMap)
            return {};
        const checker = services.program.getTypeChecker();
        const nodeMap = services.esTreeNodeToTSNodeMap;
        const decoratorNames = new Set<string>();
        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (node.source.value !== '@steinringer/angular-ts-decorators')
                    return;
                for (const specifier of node.specifiers) {
                    if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
                        && specifier.imported.name === 'Component')
                        decoratorNames.add(specifier.local.name);
                }
            },
            ClassDeclaration(node: TSESTree.ClassDeclaration) {
                if (!node.id || !decoratorNames.size)
                    return;
                const decorator = node.decorators?.find(candidate => {
                    if (candidate.expression.type !== 'CallExpression'
                        || candidate.expression.callee.type !== 'Identifier'
                        || !decoratorNames.has(candidate.expression.callee.name))
                        return false;
                    return checker.getSymbolAtLocation(nodeMap.get(candidate.expression.callee))?.declarations
                        ?.some(declaration => ts.isImportSpecifier(declaration)
                            && ts.isImportDeclaration(declaration.parent.parent.parent)
                            && ts.isStringLiteral(declaration.parent.parent.parent.moduleSpecifier)
                            && declaration.parent.parent.parent.moduleSpecifier.text === '@steinringer/angular-ts-decorators');
                });
                const options = decorator?.expression.type === 'CallExpression'
                    ? decorator.expression.arguments[0] : null;
                if (!options || options.type !== 'ObjectExpression' || options.properties.some(property => property.type === 'SpreadElement'))
                    return;
                const controllerAs = options.properties.find(property => property.type === 'Property'
                    && !property.computed && ((property.key.type === 'Identifier' && property.key.name === 'controllerAs')
                        || (property.key.type === 'Literal' && property.key.value === 'controllerAs')));
                if (controllerAs?.type === 'Property'
                    && (controllerAs.value.type !== 'Literal' || controllerAs.value.value !== '$ctrl'))
                    return;
                const classType = checker.getTypeAtLocation(nodeMap.get(node.id));
                for (const property of options.properties) {
                    if (property.type !== 'Property' || property.computed
                        || property.key.type !== 'Identifier')
                        continue;
                    const value = property.value;
                    if (property.key.name === 'template' && value.type === 'TemplateLiteral'
                        && value.expressions.length === 0) {
                        const html = value.quasis.map(quasi => quasi.value.cooked || '').join('');
                        for (const member of findPrivateMembers(html, classType))
                            context.report({ node: value, messageId: 'visibility', data: { member } });
                    }
                    if (property.key.name === 'template' && value.type === 'Literal'
                        && typeof value.value === 'string') {
                        for (const member of findPrivateMembers(value.value, classType))
                            context.report({ node: value, messageId: 'visibility', data: { member } });
                    }
                    if (property.key.name === 'templateUrl' && value.type === 'Literal'
                        && typeof value.value === 'string') {
                        const html = readRelativeHtmlTemplate(context.getFilename(), value.value);
                        if (html !== null)
                            for (const member of findPrivateMembers(html, classType))
                                context.report({ node: value, messageId: 'visibility', data: { member } });
                    }
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'visibility', []>;
