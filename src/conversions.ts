import { GmockStyle } from './gmock_helper';

export function gmockStyleFromStr(str: string) : GmockStyle {
    switch(str) {
        case "old":
            return GmockStyle.Old;
        case "new":
            return GmockStyle.New;
        default:
            throw new Error(`Unknown style '${str}'`);
    }
}