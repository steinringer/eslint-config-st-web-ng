import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { parseFragment } from 'parse5';
import * as ts from 'typescript';
import { readRelativeHtmlTemplate } from './template-file';

type HtmlNode = {
    nodeName: string;
    childNodes?: HtmlNode[];
    sourceCodeLocation?: { startTag?: { startOffset: number; endOffset: number } };
};

const selectorCache = new WeakMap<ts.Program, Map<string, string>>();

function knownHybridSelectors(program: ts.Program): Map<string, string> {
    const cached = selectorCache.get(program);
    if (cached)
        return cached;
    const selectors = new Map<string, string>();
    const ambiguous = new Set<string>();
    for (const file of program.getSourceFiles()) {
        const componentNames = new Set<string>();
        for (const statement of file.statements) {
            if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
                || statement.moduleSpecifier.text !== '@steinringer/angular-ts-decorators'
                || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings))
                continue;
            for (const importName of statement.importClause.namedBindings.elements)
                if ((importName.propertyName || importName.name).text === 'Component')
                    componentNames.add(importName.name.text);
        }
        if (!componentNames.size)
            continue;
        for (const statement of file.statements) {
            if (!ts.isClassDeclaration(statement))
                continue;
            for (const decorator of ts.getDecorators(statement) || []) {
                if (!ts.isCallExpression(decorator.expression)
                    || !ts.isIdentifier(decorator.expression.expression)
                    || !componentNames.has(decorator.expression.expression.text)
                    || !ts.isObjectLiteralExpression(decorator.expression.arguments[0]))
                    continue;
                for (const property of decorator.expression.arguments[0].properties) {
                    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)
                        || property.name.text !== 'selector' || !ts.isStringLiteralLike(property.initializer))
                        continue;
                    const selector = property.initializer.text;
                    if (!/^[a-z][A-Za-z0-9]*$/.test(selector) || /[A-Z]{2}/.test(selector))
                        continue;
                    const key = selector.toLowerCase();
                    const expected = selector.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
                    if (selectors.has(key) && selectors.get(key) !== expected)
                        ambiguous.add(key);
                    else if (!ambiguous.has(key))
                        selectors.set(key, expected);
                }
            }
        }
    }
    for (const key of ambiguous)
        selectors.delete(key);
    selectorCache.set(program, selectors);
    return selectors;
}

function wrongTags(html: string, selectors: Map<string, string>, canonicalSelectors: Set<string>): string[] {
    const wrong: string[] = [];
    const visit = (node: HtmlNode) => {
        const tag = node.sourceCodeLocation?.startTag;
        if (tag) {
            const name = html.slice(tag.startOffset, tag.endOffset).match(/^<([^\s/>]+)/)?.[1];
            if (name) {
                const expected = selectors.get(name.toLowerCase());
                if (expected && name !== expected)
                    wrong.push(expected);
                else if (!expected && canonicalSelectors.has(name.toLowerCase()) && name !== name.toLowerCase())
                    wrong.push(name.toLowerCase());
            }
        }
        for (const child of node.childNodes || [])
            visit(child);
    };
    visit(parseFragment(html, { sourceCodeLocationInfo: true }) as HtmlNode);
    return wrong;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: { tag: "Use <{{expected}}> for this hybrid component in HTML." }
    },
    create(context) {
        const program = context.sourceCode.parserServices?.program;
        if (!program)
            return {};
        const selectors = knownHybridSelectors(program);
        if (!selectors.size)
            return {};
        const canonicalSelectors = new Set(selectors.values());
        const componentNames = new Set<string>();
        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (node.source.value !== '@steinringer/angular-ts-decorators')
                    return;
                for (const specifier of node.specifiers)
                    if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
                        && specifier.imported.name === 'Component')
                        componentNames.add(specifier.local.name);
            },
            ClassDeclaration(node: TSESTree.ClassDeclaration) {
                const decorator = node.decorators?.find(candidate => candidate.expression.type === 'CallExpression'
                    && candidate.expression.callee.type === 'Identifier'
                    && componentNames.has(candidate.expression.callee.name));
                const options = decorator?.expression.type === 'CallExpression'
                    ? decorator.expression.arguments[0] : null;
                if (!options || options.type !== 'ObjectExpression')
                    return;
                for (const property of options.properties) {
                    if (property.type !== 'Property' || property.key.type !== 'Identifier')
                        continue;
                    if (property.key.name === 'template') {
                        const value = property.value;
                        const html = value.type === 'Literal' && typeof value.value === 'string'
                            ? value.value : value.type === 'TemplateLiteral' && value.expressions.length === 0
                                ? value.quasis.map(quasi => quasi.value.cooked || '').join('') : null;
                        if (html !== null)
                            for (const expected of wrongTags(html, selectors, canonicalSelectors))
                                context.report({ node: value, messageId: 'tag', data: { expected } });
                    }
                    if (property.key.name === 'templateUrl' && property.value.type === 'Literal'
                        && typeof property.value.value === 'string') {
                        const html = readRelativeHtmlTemplate(context.getFilename(), property.value.value);
                        if (html !== null)
                            for (const expected of wrongTags(html, selectors, canonicalSelectors))
                                context.report({ node: property.value, messageId: 'tag', data: { expected } });
                    }
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'tag', []>;
