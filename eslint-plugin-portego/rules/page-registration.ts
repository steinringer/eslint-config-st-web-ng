import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export function registeredHybridSelectors(filename: string): Set<string> {
    const selectors = new Set<string>();
    const normalized = path.resolve(filename).replace(/\\/g, '/');
    const match = normalized.match(/^(.*)\/App\/Packages\/([^/]+)\/.+$/i);
    if (!match)
        return selectors;
    const configFolder = path.join(match[1], 'Configuration', 'Packages', match[2]);
    if (!fs.existsSync(configFolder))
        return selectors;
    const visit = (value: unknown) => {
        if (!value || typeof value !== 'object')
            return;
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        const object = value as Record<string, unknown>;
        if (object.route && typeof object.route === 'object') {
            const route = object.route as Record<string, unknown>;
            if (typeof route.component === 'string' && route.ngComponent !== true)
                selectors.add(route.component);
        }
        Object.values(object).forEach(visit);
    };
    for (const entry of fs.readdirSync(configFolder, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json')
            || entry.name.toLowerCase() === 'appsettings.live.json')
            continue;
        try {
            const file = path.join(configFolder, entry.name);
            const parsed = ts.parseJsonText(file, fs.readFileSync(file, 'utf8'));
            const errors: ts.Diagnostic[] = [];
            if (!(parsed as ts.JsonSourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length) {
                const value = ts.convertToObject(parsed, errors);
                if (!errors.length)
                    visit(value);
            }
        } catch {
            // Invalid registration is incomplete evidence, not a page violation.
        }
    }
    return selectors;
}
