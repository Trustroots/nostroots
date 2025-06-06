"use strict";
// import { version as PACKAGE_VERSION } from "./deno.json" with { type: "json" };
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./constants.js"), exports);
__exportStar(require("./src/filter.schema.js"), exports);
__exportStar(require("./src/base.schema.js"), exports);
__exportStar(require("./src/utils.js"), exports);
__exportStar(require("./src/10390.schema.js"), exports);
__exportStar(require("./src/10395.schema.js"), exports);
__exportStar(require("./src/30397.schema.js"), exports);
__exportStar(require("./src/30398.schema.js"), exports);
__exportStar(require("./src/event.schema.js"), exports);
__exportStar(require("./src/isValidEvent.js"), exports);
__exportStar(require("./src/getAuthorFromEvent.js"), exports);
