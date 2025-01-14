import { type Event } from "./mod.js";
export declare function isHex(s: string): boolean;
export declare function isHexKey(key: string): boolean;
export declare function isPlusCode(code: string): boolean;
export declare function getCurrentTimestamp(): number;
export declare function getFirstTagValueFromEvent(nostrEvent: Event, tagName: string): string | undefined;
export declare function getFirstLabelValueFromTags(tags: string[][], labelName: string): string | undefined;
export declare function createLabelTags(labelName: string, labelValue: string | string[]): string[][];
export declare function getFirstLabelValueFromEvent(nostrEvent: Event, labelName: string): string | undefined;
export declare function getPlusCodePrefix(plusCode: string, length: number): string;
export declare function getAllPlusCodePrefixes(plusCode: string, minimumLength: number): string[];
export declare function getPlusCodeAndPlusCodePrefixTags(plusCode: string): string[][];
//# sourceMappingURL=utils.d.ts.map