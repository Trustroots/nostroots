export declare const MOCK_SYMBOL: unique symbol;
export type MockCall = {
    args: any[];
    returned?: any;
    thrown?: any;
    timestamp: number;
    returns: boolean;
    throws: boolean;
};
export declare function getMockCalls(f: any): MockCall[];
//# sourceMappingURL=_mock_util.d.ts.map