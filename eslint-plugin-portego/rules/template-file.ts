import * as fs from 'fs';
import * as path from 'path';

export function readRelativeHtmlTemplate(componentFilename: string, templateUrl: string): string | null {
    if ((!templateUrl.startsWith('./') && !templateUrl.startsWith('../'))
        || path.extname(templateUrl).toLowerCase() !== '.html')
        return null;

    const file = path.resolve(path.dirname(componentFilename), templateUrl);
    return fs.existsSync(file) && fs.statSync(file).isFile()
        ? fs.readFileSync(file, 'utf8') : null;
}
