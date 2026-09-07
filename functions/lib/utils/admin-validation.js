"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRecord = assertRecord;
exports.assertDocumentId = assertDocumentId;
exports.validateCreditAmount = validateCreditAmount;
exports.validateReason = validateReason;
exports.readCreditBalance = readCreditBalance;
exports.validatePreviewTarget = validatePreviewTarget;
exports.normalizeCallableData = normalizeCallableData;
const functions = __importStar(require("firebase-functions/v1"));
function assertRecord(value, field = 'Request') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new functions.https.HttpsError('invalid-argument', `${field} must be an object`);
    }
}
function assertDocumentId(value, field) {
    if (typeof value !== 'string' || !value.trim() || value.length > 128 || value.includes('/') || value === '.' || value === '..') {
        throw new functions.https.HttpsError('invalid-argument', `${field} must be a valid document ID`);
    }
}
function validateCreditAmount(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Amount must be a positive safe integer');
    }
}
function validateReason(reason, required = false) {
    if (reason === undefined && !required)
        return undefined;
    if (typeof reason !== 'string' || reason.length > 1000 || (required && !reason.trim())) {
        throw new functions.https.HttpsError('invalid-argument', 'Reason must be text of at most 1000 characters and is required for deductions');
    }
    return reason.trim() || undefined;
}
function readCreditBalance(value) {
    const credits = value ?? 0;
    if (!Number.isSafeInteger(credits) || credits < 0) {
        throw new functions.https.HttpsError('failed-precondition', 'User credit balance is invalid');
    }
    return credits;
}
function validatePreviewTarget(target, angle, allowAll = false) {
    if (target !== 'mesh' && target !== 'meshImages' && !(allowAll && target === 'all')) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid preview target');
    }
    if (target === 'meshImages' && !['front', 'back', 'left', 'right'].includes(angle)) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid mesh angle is required');
    }
}
/** Older callable clients serialize optional undefined properties as null. */
function normalizeCallableData(data) {
    assertRecord(data);
    const omitNullFields = (value) => {
        if (Array.isArray(value))
            return value.map(omitNullFields);
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value)
                .filter(([, field]) => field !== null && field !== undefined)
                .map(([key, field]) => [key, omitNullFields(field)]));
        }
        return value;
    };
    return omitNullFields(data);
}
//# sourceMappingURL=admin-validation.js.map