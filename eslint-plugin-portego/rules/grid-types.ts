import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { registeredHybridSelectors } from './page-registration';
import { readRelativeHtmlTemplate } from './template-file';
import { hybridComponentOptions, ownedTemplateNodes, templateLocation, type HtmlNode } from './owned-template';

function getProperty(objectExpression: TSESTree.ObjectExpression, propertyName: string) {
    return objectExpression.properties.find((property): property is TSESTree.Property => property.type === 'Property'
        && !property.computed
        && ((property.key.type === 'Identifier' && property.key.name === propertyName)
            || (property.key.type === 'Literal' && property.key.value === propertyName)));
}

function getLiteralValue(node: TSESTree.Node | undefined) {
    if (node?.type === 'Literal' && typeof node.value === 'string')
        return node.value;
    if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
        return node.quasis.map(quasi => quasi.value.raw).join('');
    return null;
}

function getTemplate(context: TSESLint.RuleContext<'options' | 'columns' | 'typedLint', []>, options: TSESTree.ObjectExpression) {
    const inlineTemplate = getLiteralValue(getProperty(options, 'template')?.value);
    if (inlineTemplate != null)
        return inlineTemplate;

    const templateUrl = getLiteralValue(getProperty(options, 'templateUrl')?.value);
    return templateUrl ? readRelativeHtmlTemplate(
        context.getPhysicalFilename ? context.getPhysicalFilename() : context.getFilename(), templateUrl) : null;
}

function getGridOptionBindings(nodes: HtmlNode[]) {
    const bindings = new Map<string, HtmlNode>();
    for (const node of nodes) {
        if (node.attrs?.some(attribute => attribute.name === 'grid')) {
            const value = node.attrs.find(attribute => attribute.name === 'options')?.value;
            const binding = value?.match(/^\s*\$ctrl\.([A-Za-z_$][\w$]*)\s*$/);
            if (binding)
                bindings.set(binding[1], node);
        }
    }
    return bindings;
}

function getMember(classNode: TSESTree.ClassDeclaration, name: string) {
    return classNode.body.body.find(member => 'key' in member && !member.computed
        && member.key?.type === 'Identifier'
        && member.key.name === name);
}

function hasExplicitAnyType(member: TSESTree.Node) {
    if (member.type !== 'PropertyDefinition' || !member.typeAnnotation)
        return false;
    const type = member.typeAnnotation.typeAnnotation;
    return type.type === 'TSAnyKeyword'
        || (type.type === 'TSUnionType' && type.types.some(part => part.type === 'TSAnyKeyword'));
}

function getType(context: TSESLint.RuleContext<'options' | 'columns' | 'typedLint', []>, member: TSESTree.Node) {
    const services = context.sourceCode.parserServices;
    if (!services?.program || !services.esTreeNodeToTSNodeMap)
        return null;

    const tsNode = services.esTreeNodeToTSNodeMap.get(member);
    return services.program.getTypeChecker().getTypeAtLocation(tsNode);
}

function hasNamedType(type: ts.Type | null, name: string, file: string): boolean {
    if (!type || (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)))
        return false;
    if (type.isUnion()) {
        const parts = type.types.filter(part => !(part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
        return parts.length > 0 && parts.every(part => hasNamedType(part, name, file));
    }
    const symbol = type.aliasSymbol || type.getSymbol();
    return symbol?.name === name && !!symbol.declarations?.some(declaration =>
        new RegExp(`/core/directives/formelements/${file.toLowerCase()}\\.(?:d\\.)?ts$`)
            .test(declaration.getSourceFile().fileName.replace(/\\/g, '/').toLowerCase()));
}

function isArrayOf(context: TSESLint.RuleContext<'options' | 'columns' | 'typedLint', []>, type: ts.Type | null, elementTypeName: string): boolean {
    if (!type || (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)))
        return false;
    if (type.isUnion()) {
        const parts = type.types.filter(part => !(part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
        return parts.length > 0 && parts.every(part => isArrayOf(context, part, elementTypeName));
    }

    const checker = context.sourceCode.parserServices!.program!.getTypeChecker();
    if (!checker.isArrayType(type))
        return false;

    const arguments_ = checker.getTypeArguments(type as ts.TypeReference);
    return arguments_.length === 1
        && hasNamedType(arguments_[0], elementTypeName, 'portego-grid-column-def');
}

function hasResolvedGrid(program: ts.Program): boolean {
    return program.getSourceFiles().some(source => {
        const filename = source.fileName.replace(/\\/g, '/').toLowerCase();
        if (!/\/core\/directives\/formelements\/portego-grid-options\.(?:d\.)?ts$/.test(filename))
            return false;
        const directive = path.join(path.dirname(source.fileName), 'portego-grid.directive.js');
        return fs.existsSync(directive) && /\.directive\(['"]grid['"]/.test(fs.readFileSync(directive, 'utf8'));
    });
}

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            options: "[PTG102] Declare bound grid options member '{{name}}' as the shared PortegoGridOptions type ({{location}}).",
            columns: "[PTG102] Declare bound grid options columnDefs as the shared PortegoGridColumnDef[] type ({{location}}).",
            structure: 'Use a div with an options binding for the Portego grid directive ({{location}}).',
            typedLint: '[PTG102] Configure typed linting before enabling the Portego grid rule.'
        }
    },

    create(context) {
        if (!context.sourceCode.parserServices?.program || !context.sourceCode.parserServices.esTreeNodeToTSNodeMap) {
            return {
                Program(node) {
                    context.report({ node, messageId: 'typedLint' });
                }
            };
        }

        if (!hasResolvedGrid(context.sourceCode.parserServices.program))
            return {};

        const checker = context.sourceCode.parserServices.program.getTypeChecker();
        const nodeMap = context.sourceCode.parserServices.esTreeNodeToTSNodeMap;
        const pageSelectors = registeredHybridSelectors(context.getFilename());

        return {
            'Program:exit'(program: TSESTree.Program) {
                for (const statement of program.body) {
                    const classNode = statement.type === 'ExportNamedDeclaration'
                        && statement.declaration?.type === 'ClassDeclaration' ? statement.declaration
                        : statement.type === 'ClassDeclaration' ? statement : null;
                    if (!classNode)
                        continue;

                    const options = hybridComponentOptions(classNode, checker, nodeMap);
                    const template = options && getTemplate(context, options);
                    if (!template)
                        continue;

                    const selector = getLiteralValue(getProperty(options, 'selector')?.value);
                    const nodes = ownedTemplateNodes(template);
                    const templateUrl = getLiteralValue(getProperty(options, 'templateUrl')?.value);
                    const source = templateUrl ? path.resolve(path.dirname(context.getFilename()), templateUrl) : 'inline template';
                    if (selector && pageSelectors.has(selector))
                        for (const element of nodes.filter(item => item.attrs?.some(attribute => attribute.name === 'grid')
                            && (item.nodeName !== 'div' || !item.attrs.some(attribute => attribute.name === 'options'))))
                            context.report({ node: options, messageId: 'structure', data: { location: templateLocation(element, source) } });

                    for (const [binding, element] of getGridOptionBindings(nodes)) {
                        const location = templateLocation(element, source);
                        const member = getMember(classNode, binding);
                        if (!member)
                            continue;
                        const type = getType(context, member);
                        if (!type || (type.flags & ts.TypeFlags.Unknown))
                            continue;
                        if (type.flags & ts.TypeFlags.Any) {
                            if (hasExplicitAnyType(member))
                                context.report({ node: member, messageId: 'options', data: { name: binding, location } });
                            continue;
                        }
                        if (!hasNamedType(type, 'PortegoGridOptions', 'portego-grid-options')) {
                            context.report({
                                node: member,
                                messageId: 'options',
                                data: { name: binding, location }
                            });
                            // The options annotation also supplies columnDefs. Check
                            // columns separately only after the options type is known.
                            continue;
                        }
                        const columns = checker.getPropertyOfType(type, 'columnDefs');
                        const declaration = columns?.valueDeclaration || columns?.declarations?.[0];
                        if (columns && declaration) {
                            const columnType = checker.getTypeOfSymbolAtLocation(columns, declaration);
                            if (columnType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
                                continue;
                            if (isArrayOf(context, columnType, 'PortegoGridColumnDef'))
                                continue;
                            context.report({
                                node: member,
                                messageId: 'columns',
                                data: { name: binding, location }
                            });
                        }
                    }
                }
            }
        };
    }
} satisfies TSESLint.RuleModule<'options' | 'columns' | 'structure' | 'typedLint', []>;
