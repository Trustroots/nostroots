"use strict";
// Copyright 2018-2025 the Deno authors. MIT license.
// deno-lint-ignore-file no-explicit-any
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _CloseTo_precision;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectContaining = exports.StringMatching = exports.StringContaining = exports.CloseTo = exports.ArrayContaining = exports.Any = exports.Anything = exports.AsymmetricMatcher = void 0;
exports.anything = anything;
exports.any = any;
exports.arrayContaining = arrayContaining;
exports.arrayNotContaining = arrayNotContaining;
exports.closeTo = closeTo;
exports.stringContaining = stringContaining;
exports.stringNotContaining = stringNotContaining;
exports.stringMatching = stringMatching;
exports.stringNotMatching = stringNotMatching;
exports.objectContaining = objectContaining;
exports.objectNotContaining = objectNotContaining;
const _custom_equality_tester_js_1 = require("./_custom_equality_tester.js");
const _equal_js_1 = require("./_equal.js");
class AsymmetricMatcher {
    constructor(value, inverse = false) {
        Object.defineProperty(this, "value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: value
        });
        Object.defineProperty(this, "inverse", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: inverse
        });
    }
}
exports.AsymmetricMatcher = AsymmetricMatcher;
class Anything extends AsymmetricMatcher {
    equals(other) {
        return other !== null && other !== undefined;
    }
}
exports.Anything = Anything;
function anything() {
    return new Anything();
}
class Any extends AsymmetricMatcher {
    constructor(value) {
        if (value === undefined) {
            throw new TypeError("Expected a constructor function");
        }
        super(value);
    }
    equals(other) {
        if (typeof other === "object") {
            return other instanceof this.value;
        }
        else {
            if (this.value === Number) {
                return typeof other === "number";
            }
            if (this.value === String) {
                return typeof other === "string";
            }
            if (this.value === Number) {
                return typeof other === "number";
            }
            if (this.value === Function) {
                return typeof other === "function";
            }
            if (this.value === Boolean) {
                return typeof other === "boolean";
            }
            if (this.value === BigInt) {
                return typeof other === "bigint";
            }
            if (this.value === Symbol) {
                return typeof other === "symbol";
            }
        }
        return false;
    }
}
exports.Any = Any;
function any(c) {
    return new Any(c);
}
class ArrayContaining extends AsymmetricMatcher {
    constructor(arr, inverse = false) {
        super(arr, inverse);
    }
    equals(other) {
        const res = Array.isArray(other) &&
            this.value.every((e) => other.some((another) => (0, _equal_js_1.equal)(e, another, { customTesters: (0, _custom_equality_tester_js_1.getCustomEqualityTesters)() })));
        return this.inverse ? !res : res;
    }
}
exports.ArrayContaining = ArrayContaining;
function arrayContaining(c) {
    return new ArrayContaining(c);
}
function arrayNotContaining(c) {
    return new ArrayContaining(c, true);
}
class CloseTo extends AsymmetricMatcher {
    constructor(num, precision = 2) {
        super(num);
        _CloseTo_precision.set(this, void 0);
        __classPrivateFieldSet(this, _CloseTo_precision, precision, "f");
    }
    equals(other) {
        if (typeof other !== "number") {
            return false;
        }
        if ((this.value === Number.POSITIVE_INFINITY &&
            other === Number.POSITIVE_INFINITY) ||
            (this.value === Number.NEGATIVE_INFINITY &&
                other === Number.NEGATIVE_INFINITY)) {
            return true;
        }
        return Math.abs(this.value - other) < Math.pow(10, -__classPrivateFieldGet(this, _CloseTo_precision, "f")) / 2;
    }
}
exports.CloseTo = CloseTo;
_CloseTo_precision = new WeakMap();
function closeTo(num, numDigits) {
    return new CloseTo(num, numDigits);
}
class StringContaining extends AsymmetricMatcher {
    constructor(str, inverse = false) {
        super(str, inverse);
    }
    equals(other) {
        const res = typeof other !== "string" ? false : other.includes(this.value);
        return this.inverse ? !res : res;
    }
}
exports.StringContaining = StringContaining;
function stringContaining(str) {
    return new StringContaining(str);
}
function stringNotContaining(str) {
    return new StringContaining(str, true);
}
class StringMatching extends AsymmetricMatcher {
    constructor(pattern, inverse = false) {
        super(new RegExp(pattern), inverse);
    }
    equals(other) {
        const res = typeof other !== "string" ? false : this.value.test(other);
        return this.inverse ? !res : res;
    }
}
exports.StringMatching = StringMatching;
function stringMatching(pattern) {
    return new StringMatching(pattern);
}
function stringNotMatching(pattern) {
    return new StringMatching(pattern, true);
}
class ObjectContaining extends AsymmetricMatcher {
    constructor(obj, inverse = false) {
        super(obj, inverse);
    }
    equals(other) {
        const keys = Object.keys(this.value);
        let res = true;
        for (const key of keys) {
            if (!Object.hasOwn(other, key) ||
                !(0, _equal_js_1.equal)(this.value[key], other[key])) {
                res = false;
            }
        }
        return this.inverse ? !res : res;
    }
}
exports.ObjectContaining = ObjectContaining;
function objectContaining(obj) {
    return new ObjectContaining(obj);
}
function objectNotContaining(obj) {
    return new ObjectContaining(obj, true);
}
