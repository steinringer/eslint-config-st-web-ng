export const GENERIC_DATA = 'genericData';

export class GenericData {
    getData(url: string): Promise<unknown> { return Promise.resolve(url); }
}
