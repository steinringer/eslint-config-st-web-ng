import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { parseFragment } from 'parse5';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { registeredHybridSelectors } from './page-registration';
import { readRelativeHtmlTemplate } from './template-file';

type HtmlNode = {
    nodeName: string;
    value?: string;
    attrs?: { name: string; value: string }[];
    childNodes?: HtmlNode[];
};

function hasResolvedAngularSelector(program: ts.Program, relativeFile: string[], decoratorPackage: string,
    decoratorType: string, selector: string): boolean {
    const suffix = `/App/Core/${relativeFile.join('/')}`.toLowerCase();
    let source = program.getSourceFiles().find(file => file.fileName.replace(/\\/g, '/').toLowerCase().endsWith(suffix));
    if (!source) {
        const coreFile = program.getSourceFiles().find(file => /[\\/]App[\\/]Core[\\/]/i.test(file.fileName));
        const root = coreFile?.fileName.replace(/\\/g, '/').match(/^(.*)\/App\/Core\//i)?.[1];
        const file = root ? path.join(root, 'App', 'Core', ...relativeFile) : null;
        if (file && fs.existsSync(file))
            source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    }
    if (!source)
        return false;
    const directiveNames = new Set<string>();
    for (const statement of source.statements)
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
            && statement.moduleSpecifier.text === decoratorPackage
            && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings))
            for (const importName of statement.importClause.namedBindings.elements)
                if ((importName.propertyName || importName.name).text === decoratorType)
                    directiveNames.add(importName.name.text);
    for (const statement of source.statements) {
        if (!ts.isClassDeclaration(statement))
            continue;
        for (const decorator of ts.getDecorators(statement) || []) {
            if (!ts.isCallExpression(decorator.expression)
                || !ts.isIdentifier(decorator.expression.expression)
                || !directiveNames.has(decorator.expression.expression.text)
                || !ts.isObjectLiteralExpression(decorator.expression.arguments[0]))
                continue;
            for (const property of decorator.expression.arguments[0].properties)
                if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)
                    && property.name.text === 'selector' && ts.isStringLiteralLike(property.initializer)
                    && property.initializer.text === selector)
                    return true;
        }
    }
    return false;
}

function hasResolvedCoreDirective(program: ts.Program, relativeFile: string[], directive: string): boolean {
    return program.getSourceFiles().some(source => {
        const match = source.fileName.replace(/\\/g, '/').match(/^(.*)\/App\/Core\//i);
        if (!match)
            return false;
        const file = path.join(match[1], 'App', 'Core', ...relativeFile);
        return fs.existsSync(file) && new RegExp(`\\.directive\\(['"]${directive}['"]`).test(fs.readFileSync(file, 'utf8'));
    });
}

function pageShell(html: string): HtmlNode | null {
    const fragment = parseFragment(html) as HtmlNode;
    const roots = (fragment.childNodes || []).filter(node => node.nodeName !== '#comment'
        && (node.nodeName !== '#text' || !!node.value?.trim()));
    if (roots.length !== 1 || roots[0].nodeName !== 'div')
        return null;
    const attributes = roots[0].attrs || [];
    return attributes.some(attribute => attribute.name === 'page')
        && attributes.some(attribute => attribute.name === 'class'
            && attribute.value.split(/\s+/).includes('page-content')) ? roots[0] : null;
}

function hasPageShell(html: string): boolean {
    return pageShell(html) !== null;
}

function modalAfterMain(html: string, stForm: boolean, grid: boolean, dashboard: boolean): boolean {
    const shell = pageShell(html);
    if (!shell)
        return false;
    const elements = (shell.childNodes || []).filter(node => !node.nodeName.startsWith('#'));
    if (elements.some(node => node.attrs?.some(attribute => attribute.name.startsWith('*')
        || attribute.name === 'ng-if' || attribute.name === 'ng-repeat')))
        return false;
    const main = elements.map((node, index) => ({ node, index })).filter(({ node }) =>
        (stForm && node.nodeName === 'st-form')
        || (dashboard && node.nodeName === 'st-dashboard')
        || (grid && node.nodeName === 'div' && node.attrs?.some(attribute => attribute.name === 'grid')));
    if (main.length !== 1)
        return false;
    return elements.some((node, index) => index > main[0].index
        && node.attrs?.some(attribute => attribute.name === 'actionmodal'));
}

function invalidModalForms(html: string): number {
    let count = 0;
    const visit = (node: HtmlNode, insideModal: boolean, insideWrapper: boolean) => {
        const modal = insideModal || !!node.attrs?.some(attribute => attribute.name === 'actionmodal');
        const wrapper = insideWrapper || !!node.attrs?.some(attribute => attribute.name === 'form-wrapper');
        if (node.nodeName === 'form' && modal
            && (!wrapper || !node.attrs?.some(attribute => attribute.name === 'name' && attribute.value.trim())))
            count++;
        for (const child of node.childNodes || [])
            visit(child, modal, wrapper);
    };
    visit(parseFragment(html) as HtmlNode, false, false);
    return count;
}

function modalFieldsOutsideRows(html: string, fields: { name: string; attribute: boolean }[]): number {
    let count = 0;
    const visit = (node: HtmlNode, insideModal: boolean, insideWrapper: boolean, insideForm: boolean,
        insideRow: boolean) => {
        const attrs = node.attrs || [];
        const modal = insideModal || attrs.some(attribute => attribute.name === 'actionmodal');
        const wrapper = insideWrapper || attrs.some(attribute => attribute.name === 'form-wrapper');
        const form = insideForm || node.nodeName === 'form';
        const row = insideRow || node.nodeName === 'form-row'
            || attrs.some(attribute => attribute.name === 'form-row');
        if (modal && wrapper && form && !row && fields.some(field => node.nodeName === field.name
            || (field.attribute && attrs.some(attribute => attribute.name === field.name))))
            count++;
        for (const child of node.childNodes || [])
            visit(child, modal, wrapper, form, row);
    };
    visit(parseFragment(html) as HtmlNode, false, false, false, false);
    return count;
}

function invalidActionModals(html: string): number {
    let count = 0;
    const visit = (node: HtmlNode) => {
        if (node.attrs?.some(attribute => attribute.name === 'actionmodal')
            && (node.nodeName !== 'div'
                || !node.attrs.some(attribute => attribute.name === 'modal-name' && attribute.value.trim())))
            count++;
        for (const child of node.childNodes || [])
            visit(child);
    };
    visit(parseFragment(html) as HtmlNode);
    return count;
}

function modalNames(html: string): Set<string> {
    const names = new Set<string>();
    const visit = (node: HtmlNode) => {
        if (node.nodeName === 'div' && node.attrs?.some(attribute => attribute.name === 'actionmodal')) {
            const name = node.attrs.find(attribute => attribute.name === 'modal-name')?.value.trim();
            if (name)
                names.add(name);
        }
        for (const child of node.childNodes || [])
            visit(child);
    };
    visit(parseFragment(html) as HtmlNode);
    return names;
}

function nestedStForms(html: string): number {
    let count = 0;
    const visit = (node: HtmlNode, insideForm: boolean) => {
        if (node.nodeName === 'st-form' && insideForm)
            count++;
        for (const child of node.childNodes || [])
            visit(child, insideForm || node.nodeName === 'form');
    };
    visit(parseFragment(html) as HtmlNode, false);
    return count;
}

export = {
    defaultOptions: [],
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            shell: 'Wrap this registered hybrid page template in <div page class="page-content">.',
            order: 'Place action modals before the main form, grid, or dashboard.',
            nestedForm: 'Do not put st-form inside another form; st-form creates its own form.',
            modal: 'Declare action modals on a div with a nonempty modal-name.',
            modalName: "Use the declared modal name '{{name}}' with the same casing.",
            modalForm: 'Put each handwritten modal form inside form-wrapper and give it a name.',
            formRow: 'Put this handwritten modal field inside form-row.'
        }
    },
    create(context) {
        const componentNames = new Set<string>();
        const selectors = registeredHybridSelectors(context.getFilename());
        if (!selectors.size)
            return {};
        const program = context.sourceCode.parserServices?.program;
        if (!program)
            return {};
        const resolvedStForm = hasResolvedAngularSelector(program,
            ['directives', 'formElements', 'st-form.directive.ts'], '@steinringer/angular-ts-decorators', 'Directive', 'st-form');
        const resolvedActionModal = hasResolvedAngularSelector(program,
            ['components', 'action-bar', 'action-modal.component.ts'], '@angular/core', 'Component', '[actionmodal]');
        const resolvedDashboard = hasResolvedAngularSelector(program,
            ['components', 'dashboard', 'dashboard.component.ts'], '@angular/core', 'Component', 'st-dashboard');
        const resolvedGrid = hasResolvedCoreDirective(program,
            ['directives', 'formElements', 'portego-grid.directive.js'], 'grid');
        const resolvedFormWrapper = hasResolvedCoreDirective(program,
            ['directives', 'formElements', 'form-wrapper.directive.js'], 'formWrapper');
        const resolvedFormRow = hasResolvedCoreDirective(program,
            ['directives', 'formElements', 'form-row.directive.js'], 'formRow');
        const modalFields = [
            hasResolvedCoreDirective(program, ['directives', 'formElements', 'date-textbox.directive.js'], 'dateTextbox')
                ? { name: 'date-textbox', attribute: true } : null,
            hasResolvedCoreDirective(program, ['directives', 'formElements', 'dropdown.directive.js'], 'dropdown')
                ? { name: 'dropdown', attribute: false } : null,
            hasResolvedAngularSelector(program, ['directives', 'formElements', 'checkbox-group.directive.ts'],
                '@steinringer/angular-ts-decorators', 'Directive', 'checkbox-group')
                ? { name: 'checkbox-group', attribute: false } : null,
            hasResolvedAngularSelector(program, ['directives', 'formElements', 'datetime-textbox.directive.ts'],
                '@steinringer/angular-ts-decorators', 'Directive', 'datetime-textbox')
                ? { name: 'datetime-textbox', attribute: true } : null
        ].filter((field): field is { name: string; attribute: boolean } => field !== null);
        const checker = program.getTypeChecker();
        const nodeMap = context.sourceCode.parserServices?.esTreeNodeToTSNodeMap;
        const namesByClass = new WeakMap<TSESTree.ClassDeclaration, Set<string>>();
        const checkTemplate = (html: string, node: TSESTree.Node, pageClass: TSESTree.ClassDeclaration) => {
            // A route-only container delegates layout to its child view.
            const roots = ((parseFragment(html) as HtmlNode).childNodes || [])
                .filter(child => child.nodeName !== '#comment' && (child.nodeName !== '#text' || !!child.value?.trim()));
            if (roots.length === 1
                && (roots[0].nodeName === 'ui-view' || roots[0].attrs?.some(attribute => attribute.name === 'ui-view'))
                && !roots[0].childNodes?.some(child => child.nodeName !== '#comment'
                    && (child.nodeName !== '#text' || !!child.value?.trim())))
                return;
            if (resolvedActionModal)
                namesByClass.set(pageClass, modalNames(html));
            if (!hasPageShell(html))
                context.report({ node, messageId: 'shell' });
            if (resolvedActionModal && modalAfterMain(html, resolvedStForm, resolvedGrid, resolvedDashboard))
                context.report({ node, messageId: 'order' });
            if (resolvedStForm)
                for (let index = 0; index < nestedStForms(html); index++)
                    context.report({ node, messageId: 'nestedForm' });
            if (resolvedActionModal)
                for (let index = 0; index < invalidActionModals(html); index++)
                    context.report({ node, messageId: 'modal' });
            if (resolvedActionModal && resolvedFormWrapper)
                for (let index = 0; index < invalidModalForms(html); index++)
                    context.report({ node, messageId: 'modalForm' });
            if (resolvedActionModal && resolvedFormWrapper && resolvedFormRow)
                for (let index = 0; index < modalFieldsOutsideRows(html, modalFields); index++)
                    context.report({ node, messageId: 'formRow' });
        };
        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (node.source.value !== '@steinringer/angular-ts-decorators')
                    return;
                for (const specifier of node.specifiers) {
                    if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
                        && specifier.imported.name === 'Component')
                        componentNames.add(specifier.local.name);
                }
            },
            ClassDeclaration(node: TSESTree.ClassDeclaration) {
                const decorator = node.decorators?.find(candidate => candidate.expression.type === 'CallExpression'
                    && candidate.expression.callee.type === 'Identifier'
                    && componentNames.has(candidate.expression.callee.name));
                const options = decorator?.expression.type === 'CallExpression'
                    ? decorator.expression.arguments[0] : null;
                if (!options || options.type !== 'ObjectExpression'
                    || options.properties.some(property => property.type === 'SpreadElement' || property.computed))
                    return;
                const property = (name: string) => {
                    const matches = options.properties.filter(candidate => candidate.type === 'Property'
                        && !candidate.computed && ((candidate.key.type === 'Identifier' && candidate.key.name === name)
                            || (candidate.key.type === 'Literal' && candidate.key.value === name)));
                    return matches.length === 1 ? matches[0] : undefined;
                };
                const selector = property('selector');
                if (!selector || selector.type !== 'Property' || selector.value.type !== 'Literal'
                    || typeof selector.value.value !== 'string' || !selectors.has(selector.value.value))
                    return;
                const template = property('template');
                const templateUrl = property('templateUrl');
                if (template?.type === 'Property') {
                    const value = template.value;
                    const html = value.type === 'Literal' && typeof value.value === 'string'
                        ? value.value
                        : value.type === 'TemplateLiteral' && value.expressions.length === 0
                            ? value.quasis.map(quasi => quasi.value.cooked || '').join('') : null;
                    if (html !== null)
                        checkTemplate(html, value, node);
                }
                if (templateUrl?.type === 'Property' && templateUrl.value.type === 'Literal'
                    && typeof templateUrl.value.value === 'string') {
                    const html = readRelativeHtmlTemplate(context.getFilename(), templateUrl.value.value);
                    if (html !== null)
                        checkTemplate(html, templateUrl.value, node);
                }
            },
            CallExpression(node: TSESTree.CallExpression) {
                if (!resolvedActionModal || !nodeMap || node.arguments[0]?.type !== 'Literal'
                    || typeof node.arguments[0].value !== 'string')
                    return;
                const pageClass = context.getAncestors().reverse().find((ancestor): ancestor is TSESTree.ClassDeclaration =>
                    ancestor.type === 'ClassDeclaration');
                const names = pageClass && namesByClass.get(pageClass);
                if (!names?.size)
                    return;
                const call = nodeMap.get(node);
                if (!ts.isCallExpression(call))
                    return;
                const method = checker.getResolvedSignature(call)?.declaration;
                if (!method || !ts.isMethodDeclaration(method) || !ts.isIdentifier(method.name)
                    || method.name.text !== 'show' || !ts.isClassDeclaration(method.parent)
                    || method.parent.name?.text !== 'ActionModalVisibilityService'
                    || !/[\\/]Core[\\/]services[\\/]action-modal-visibility\.service\.(?:d\.)?ts$/i.test(method.getSourceFile().fileName))
                    return;
                const calledName = node.arguments[0].value;
                const matching = [...names].filter(name => name.toLowerCase() === calledName.toLowerCase());
                if (matching.length === 1 && matching[0] !== calledName)
                    context.report({ node: node.arguments[0], messageId: 'modalName', data: { name: matching[0] } });
            }
        };
    }
} satisfies TSESLint.RuleModule<'shell' | 'order' | 'nestedForm' | 'modal' | 'modalName' | 'modalForm' | 'formRow', []>;
