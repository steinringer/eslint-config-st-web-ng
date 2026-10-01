import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { parse, parseFragment } from 'parse5';
import * as fs from 'fs';
import * as path from 'path';
import { readRelativeHtmlTemplate } from './template-file';

type HtmlNode = {
    nodeName: string;
    value?: string;
    attrs?: { name: string; value: string }[];
    childNodes?: HtmlNode[];
};

type ResourceClass = { name: string; keys: Map<string, { name: string; value: string }> };

function descendants(node: HtmlNode): HtmlNode[] {
    return [node, ...(node.childNodes || []).flatMap(descendants)];
}

function textContent(node: HtmlNode): string {
    return (node.value || '') + (node.childNodes || []).map(textContent).join('');
}

function resources(filename: string): Map<string, ResourceClass> {
    const match = path.resolve(filename).replace(/\\/g, '/').match(/^(.*)\/(Portego\.[^/]+)\.Web\/App\//i);
    const result = new Map<string, ResourceClass>();
    const ambiguousClasses = new Set<string>();
    if (!match)
        return result;

    for (const suffix of ['Localization', 'Resources']) {
        const directory = path.join(match[1], match[2] + '.' + suffix);
        if (!fs.existsSync(directory))
            continue;
        for (const file of fs.readdirSync(directory).filter(name => /JS\.resx$/i.test(name)
            || match[2] === 'Portego.Intranet' && suffix === 'Resources'
                && (name === 'Common.resx' || name === 'Perspectives.resx'))) {
            const className = file.slice(0, -'.resx'.length);
            if (className.length < 2 || className[1] === className[1].toUpperCase())
                continue;
            const source = fs.readFileSync(path.join(directory, file), 'utf8');
            const keys = new Map<string, { name: string; value: string }>();
            const ambiguousKeys = new Set<string>();
            for (const data of descendants(parse(source) as HtmlNode).filter(node => node.nodeName === 'data')) {
                const name = data.attrs?.find(attribute => attribute.name === 'name')?.value;
                const value = data.childNodes?.find(node => node.nodeName === 'value');
                if (!name || !value)
                    continue;
                const key = name.toLowerCase();
                if (keys.has(key)) {
                    keys.delete(key);
                    ambiguousKeys.add(key);
                } else if (!ambiguousKeys.has(key))
                    keys.set(key, { name, value: textContent(value) });
            }
            const key = className.toLowerCase();
            if (result.has(key)) {
                result.delete(key);
                ambiguousClasses.add(key);
            } else if (!ambiguousClasses.has(key))
                result.set(key, { name: className[0].toLowerCase() + className.slice(1), keys });
        }
    }
    return result;
}

function requiredArguments(value: string): number {
    let highest = -1;
    for (let index = 0; index < value.length; index++) {
        if (value[index] !== '{')
            continue;
        if (value[index + 1] === '{') {
            const end = value.indexOf('}}', index + 2);
            index = end < 0 ? index + 1 : end + 1;
            continue;
        }
        const end = value.indexOf('}', index + 1);
        if (end > index + 1 && /^\d+$/.test(value.slice(index + 1, end))) {
            highest = Math.max(highest, Number(value.slice(index + 1, end)));
            index = end;
        }
    }
    return highest + 1;
}

function localizationFields(owner: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    names: Set<string>): Set<string> {
    const result = new Set<string>();
    for (const member of owner.body.body) {
        if (member.type !== 'MethodDefinition' || member.kind !== 'constructor')
            continue;
        for (const argument of member.value.params) {
            if (argument.type !== 'TSParameterProperty' || argument.parameter.type !== 'Identifier'
                || argument.parameter.typeAnnotation?.typeAnnotation.type !== 'TSTypeReference'
                || argument.parameter.typeAnnotation.typeAnnotation.typeName.type !== 'Identifier'
                || !names.has(argument.parameter.typeAnnotation.typeAnnotation.typeName.name))
                continue;
            result.add(argument.parameter.name);
        }
    }
    return result;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'problem',
        schema: [],
        messages: {
            className: 'Use the browser resource class name {{expected}}.',
            arguments: 'Pass {{count}} placeholder value(s) to Localization.get.'
        }
    },
    create(context) {
        const resourceClasses = resources(context.filename);
        if (!resourceClasses.size)
            return {};
        const localizationNames = new Set<string>();
        const componentNames = new Set<string>();
        function checkReference(reference: string, node: TSESTree.Node, argumentCount?: number): void {
            const [className, keyName, extra] = reference.split('.');
            if (!className || !keyName || extra)
                return;
            const resourceClass = resourceClasses.get(className.toLowerCase());
            if (!resourceClass)
                return;
            if (className !== resourceClass.name)
                context.report({ node, messageId: 'className', data: { expected: resourceClass.name } });
            const resource = resourceClass.keys.get(keyName.toLowerCase());
            if (!resource)
                return;
            // The convention and browser serializer disagree on key casing.
            // Keep placeholder checks, but do not recommend renaming a key.
            const count = requiredArguments(resource.value);
            if (argumentCount !== undefined && count > argumentCount)
                context.report({ node, messageId: 'arguments', data: { count: String(count) } });
        }
        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (node.source.value === '@angular/core'
                    || node.source.value === '@steinringer/angular-ts-decorators')
                    for (const specifier of node.specifiers)
                        if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
                            && specifier.imported.name === 'Component')
                            componentNames.add(specifier.local.name);
                if (node.source.value !== '@steinringer/p2/core/services'
                    && !/\bCore\/services(?:\/localization\.service)?$/.test(String(node.source.value)))
                    return;
                for (const specifier of node.specifiers)
                    if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
                        && specifier.imported.name === 'Localization')
                        localizationNames.add(specifier.local.name);
            },
            CallExpression(node: TSESTree.CallExpression) {
                if (node.callee.type !== 'MemberExpression' || node.callee.computed
                    || node.callee.property.type !== 'Identifier' || node.callee.property.name !== 'get'
                    || node.callee.object.type !== 'MemberExpression' || node.callee.object.computed
                    || node.callee.object.object.type !== 'ThisExpression'
                    || node.callee.object.property.type !== 'Identifier'
                    || node.arguments[0]?.type !== 'Literal' || typeof node.arguments[0].value !== 'string')
                    return;
                const owner = context.sourceCode.getAncestors(node).reverse().find(ancestor =>
                    ancestor.type === 'ClassDeclaration' || ancestor.type === 'ClassExpression') as
                    TSESTree.ClassDeclaration | TSESTree.ClassExpression | undefined;
                if (!owner || !localizationFields(owner, localizationNames).has(node.callee.object.property.name))
                    return;
                checkReference(node.arguments[0].value, node.arguments[0],
                    node.arguments.slice(1).some(argument => argument.type === 'SpreadElement')
                        ? undefined : node.arguments.length - 1);
            },
            ClassDeclaration(node: TSESTree.ClassDeclaration) {
                for (const decorator of node.decorators || []) {
                    if (decorator.expression.type !== 'CallExpression'
                        || decorator.expression.callee.type !== 'Identifier'
                        || !componentNames.has(decorator.expression.callee.name)
                        || decorator.expression.arguments[0]?.type !== 'ObjectExpression')
                        continue;
                    for (const property of decorator.expression.arguments[0].properties) {
                        if (property.type !== 'Property' || property.key.type !== 'Identifier')
                            continue;
                        const literal = property.value.type === 'Literal' && typeof property.value.value === 'string'
                            ? property.value.value
                            : property.value.type === 'TemplateLiteral' && property.value.expressions.length === 0
                                ? property.value.quasis[0]?.value.cooked : null;
                        if (!literal)
                            continue;
                        let html = property.key.name === 'template' ? literal : null;
                        if (property.key.name === 'templateUrl')
                            html = readRelativeHtmlTemplate(context.filename, literal);
                        if (!html)
                            continue;
                        for (const item of descendants(parseFragment(html) as HtmlNode)) {
                            const expressions = item.nodeName === '#text' ? [item.value || '']
                                : (item.attrs || []).map(attribute => attribute.value);
                            for (const expression of expressions)
                                for (const match of expression.matchAll(/(['"])([A-Za-z][A-Za-z0-9]*\.[A-Za-z_][A-Za-z0-9_]*)\1\s*\|\s*stLoc\b/g))
                                    checkReference(match[2], property.value,
                                        /^\s*(?:\}\}|$)/.test(expression.slice((match.index || 0) + match[0].length))
                                            ? 0 : undefined);
                        }
                    }
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'className' | 'arguments', []>;
