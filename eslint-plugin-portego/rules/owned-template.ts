import type { TSESTree } from '@typescript-eslint/utils';
import { parseFragment } from 'parse5';
import * as ts from 'typescript';

export type HtmlNode = {
    nodeName: string;
    attrs?: { name: string; value: string }[];
    childNodes?: HtmlNode[];
    sourceCodeLocation?: { startLine: number; startCol: number } | null;
};

export function hybridComponentOptions(node: TSESTree.ClassDeclaration, checker: ts.TypeChecker,
    nodeMap: { get(node: TSESTree.Node): ts.Node }): TSESTree.ObjectExpression | null {
    const decorator = node.decorators?.find(candidate => {
        if (candidate.expression.type !== 'CallExpression' || candidate.expression.callee.type !== 'Identifier')
            return false;
        return checker.getSymbolAtLocation(nodeMap.get(candidate.expression.callee))?.declarations?.some(declaration =>
            ts.isImportSpecifier(declaration) && (declaration.propertyName || declaration.name).text === 'Component'
            && ts.isImportDeclaration(declaration.parent.parent.parent)
            && ts.isStringLiteral(declaration.parent.parent.parent.moduleSpecifier)
            && declaration.parent.parent.parent.moduleSpecifier.text === '@steinringer/angular-ts-decorators');
    });
    const options = decorator?.expression.type === 'CallExpression' ? decorator.expression.arguments[0] : null;
    if (!options || options.type !== 'ObjectExpression' || options.properties.some(property =>
        property.type !== 'Property' || property.computed))
        return null;
    const controllerAs = options.properties.find(property => property.type === 'Property'
        && (property.key.type === 'Identifier' ? property.key.name === 'controllerAs'
            : property.key.type === 'Literal' && property.key.value === 'controllerAs'));
    if (controllerAs?.type === 'Property'
        && (controllerAs.value.type !== 'Literal' || controllerAs.value.value !== '$ctrl'))
        return null;
    return options;
}

// Only return markup whose $ctrl binding still belongs to the component.
export function ownedTemplateNodes(html: string): HtmlNode[] {
    const root = parseFragment(html, { sourceCodeLocationInfo: true }) as HtmlNode;
    const normalize = (name: string) => name.replace(/^(?:data-|x-)/, '').replace(/[:_]/g, '-');
    const rebindsParent = (node: HtmlNode): boolean => !!node.attrs?.some(attribute =>
        (/^ng-repeat(?:-start)?$/.test(normalize(attribute.name)) && /\bas\s+\$ctrl\b/.test(attribute.value))
        || (normalize(attribute.name) === 'ng-init' && /\$ctrl\s*=(?!=)/.test(attribute.value)))
        || !!node.childNodes?.some(rebindsParent);
    if (rebindsParent(root))
        return [];
    const result: HtmlNode[] = [];
    const visit = (node: HtmlNode) => {
        if (node.attrs?.some(attribute => {
            const name = normalize(attribute.name);
            return name === 'ng-non-bindable' || name === 'ng-controller'
                || (name === 'ng-repeat' && /\$ctrl\b/.test(attribute.value.split(/\s+in\s+/)[0]));
        }))
            return;
        result.push(node);
        const repeats: boolean[] = [];
        for (const child of node.childNodes || []) {
            const repeat = child.attrs?.find(attribute => normalize(attribute.name) === 'ng-repeat-start');
            if (repeat)
                repeats.push(/\$ctrl\b/.test(repeat.value.split(/\s+in\s+/)[0]));
            if (!repeats.some(Boolean))
                visit(child);
            if (child.attrs?.some(attribute => normalize(attribute.name) === 'ng-repeat-end'))
                repeats.pop();
        }
    };
    visit(root);
    return result;
}

export function templateLocation(node: HtmlNode, source: string): string {
    const location = node.sourceCodeLocation;
    return location ? `${source}:${location.startLine}:${location.startCol}` : source;
}
