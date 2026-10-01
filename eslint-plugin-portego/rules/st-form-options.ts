import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { registeredHybridSelectors } from './page-registration';
import { readRelativeHtmlTemplate } from './template-file';
import { hybridComponentOptions, ownedTemplateNodes, templateLocation } from './owned-template';

function hasStFormDirective(program: ts.Program): boolean {
    let source = program.getSourceFiles().find(file => file.fileName.replace(/\\/g, '/').toLowerCase()
        .endsWith('/app/core/directives/formelements/st-form.directive.ts'));
    if (!source) {
        const coreFile = program.getSourceFiles().find(file => /[\\/]App[\\/]Core[\\/]/i.test(file.fileName));
        const root = coreFile?.fileName.replace(/\\/g, '/').match(/^(.*)\/App\/Core\//i)?.[1];
        const file = root ? path.join(root, 'App', 'Core', 'directives', 'formElements', 'st-form.directive.ts') : null;
        if (file && fs.existsSync(file))
            source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    }
    if (!source)
        return false;
    const decorators = new Set<string>();
    for (const statement of source.statements)
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
            && statement.moduleSpecifier.text === '@steinringer/angular-ts-decorators'
            && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings))
            for (const binding of statement.importClause.namedBindings.elements)
                if ((binding.propertyName || binding.name).text === 'Directive')
                    decorators.add(binding.name.text);
    return source.statements.some(statement => ts.isClassDeclaration(statement)
        && (ts.getDecorators(statement) || []).some(decorator => ts.isCallExpression(decorator.expression)
            && ts.isIdentifier(decorator.expression.expression)
            && decorators.has(decorator.expression.expression.text)
            && ts.isObjectLiteralExpression(decorator.expression.arguments[0])
            && decorator.expression.arguments[0].properties.some(property => ts.isPropertyAssignment(property)
                && ts.isIdentifier(property.name) && property.name.text === 'selector'
                && ts.isStringLiteralLike(property.initializer) && property.initializer.text === 'st-form')));
}

function isSharedFormOptions(type: ts.Type): boolean {
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
        return false;
    if (type.isUnion()) {
        const parts = type.types.filter(part => !(part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
        return parts.length > 0 && parts.every(isSharedFormOptions);
    }
    const symbol = type.aliasSymbol || type.getSymbol();
    return symbol?.name === 'STFormOptions' && !!symbol.declarations?.some(declaration =>
        declaration.getSourceFile().fileName.replace(/\\/g, '/').toLowerCase()
            .match(/\/core\/directives\/formelements\/types\/form-options\.(?:d\.)?ts$/));
}

function componentTemplate(filename: string, options: TSESTree.ObjectExpression): string | null {
    const property = (name: string) => options.properties.find(candidate => candidate.type === 'Property'
        && !candidate.computed && candidate.key.type === 'Identifier' && candidate.key.name === name);
    const inline = property('template');
    if (inline?.type === 'Property') {
        if (inline.value.type === 'Literal' && typeof inline.value.value === 'string')
            return inline.value.value;
        if (inline.value.type === 'TemplateLiteral' && inline.value.expressions.length === 0)
            return inline.value.quasis.map(quasi => quasi.value.cooked || '').join('');
    }
    const url = property('templateUrl');
    if (url?.type !== 'Property' || url.value.type !== 'Literal'
        || typeof url.value.value !== 'string')
        return null;
    return readRelativeHtmlTemplate(filename, url.value.value);
}

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            name: 'Give this st-form a nonempty name ({{location}}).',
            options: 'Bind this st-form options to a component member ({{location}}).',
            type: "Declare st-form options member '{{name}}' as the shared STFormOptions type ({{location}})."
        }
    },
    create(context) {
        const services = context.sourceCode.parserServices;
        if (!services?.program || !services.esTreeNodeToTSNodeMap || !hasStFormDirective(services.program))
            return {};
        const checker = services.program.getTypeChecker();
        const nodeMap = services.esTreeNodeToTSNodeMap;
        const pageSelectors = registeredHybridSelectors(context.getFilename());
        return {
            ClassDeclaration(node: TSESTree.ClassDeclaration) {
                if (!node.id)
                    return;
                const options = hybridComponentOptions(node, checker, nodeMap);
                if (!options)
                    return;
                const html = componentTemplate(context.getFilename(), options);
                if (html === null)
                    return;
                const selector = options.properties.find(candidate => candidate.type === 'Property'
                    && !candidate.computed && candidate.key.type === 'Identifier'
                    && candidate.key.name === 'selector');
                const page = selector?.type === 'Property' && selector.value.type === 'Literal'
                    && typeof selector.value.value === 'string' && pageSelectors.has(selector.value.value);
                const classType = checker.getTypeAtLocation(nodeMap.get(node.id));
                const templateUrl = options.properties.find(property => property.type === 'Property'
                    && property.key.type === 'Identifier' && property.key.name === 'templateUrl');
                const source = templateUrl?.type === 'Property' && templateUrl.value.type === 'Literal'
                    && typeof templateUrl.value.value === 'string'
                    ? path.resolve(path.dirname(context.getFilename()), templateUrl.value.value) : 'inline template';
                for (const form of ownedTemplateNodes(html).filter(element => element.nodeName === 'st-form')) {
                    const location = templateLocation(form, source);
                    const name = form.attrs?.find(attribute => attribute.name === 'name');
                    if (page && !name?.value.trim())
                        context.report({ node, messageId: 'name', data: { location } });
                    const binding = form.attrs?.find(attribute => attribute.name === 'options');
                    if (page && !binding?.value.trim())
                        context.report({ node, messageId: 'options', data: { location } });
                    const match = binding?.value.match(/^\s*\$ctrl\.([A-Za-z_$][\w$]*)\s*$/);
                    if (!match)
                        continue;
                    const member = classType.getProperty(match[1]);
                    const declaration = member?.valueDeclaration || member?.declarations?.[0];
                    if (!member || !declaration)
                        continue;
                    const type = checker.getTypeOfSymbolAtLocation(member, declaration);
                    if (!(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) && !isSharedFormOptions(type))
                        context.report({ node, messageId: 'type', data: { name: match[1], location } });
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'name' | 'options' | 'type', []>;
