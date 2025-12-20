"use strict";
/**
 * Provider Factory
 *
 * Factory pattern for creating 3D generation provider instances.
 * Uses singleton pattern to reuse provider instances.
 * Supports: Rodin, Meshy, Hunyuan 3D, Tripo3D
 */
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
exports.ProviderFactory = void 0;
exports.createProvider = createProvider;
exports.isValidProvider = isValidProvider;
const functions = __importStar(require("firebase-functions"));
const client_1 = require("./rodin/client");
const client_2 = require("./meshy/client");
const client_3 = require("./hunyuan/client");
const client_4 = require("./tripo/client");
const client_5 = require("./hitem3d/client");
/**
 * Factory for creating provider instances
 */
class ProviderFactory {
    static instances = new Map();
    /**
     * Get provider instance (singleton per type)
     */
    static getProvider(type) {
        if (!this.instances.has(type)) {
            this.instances.set(type, this.createProvider(type));
        }
        return this.instances.get(type);
    }
    /**
     * Create new provider instance
     */
    static createProvider(type) {
        switch (type) {
            case 'rodin':
                return this.createRodinProvider();
            case 'meshy':
                return this.createMeshyProvider();
            case 'hunyuan':
                return this.createHunyuanProvider();
            case 'tripo':
                return this.createTripoProvider();
            case 'hitem3d':
                return this.createHitem3DProvider();
            default:
                throw new functions.https.HttpsError('invalid-argument', `Unknown provider type: ${type}`);
        }
    }
    static createRodinProvider() {
        const apiKey = process.env.RODIN_API_KEY;
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'Rodin API key not configured');
        }
        return new client_1.RodinProvider(apiKey);
    }
    static createMeshyProvider() {
        const apiKey = process.env.MESHY_API_KEY;
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'Meshy API key not configured');
        }
        return new client_2.MeshyProvider(apiKey);
    }
    static createHunyuanProvider() {
        const secretId = process.env.TENCENT_SECRET_ID;
        const secretKey = process.env.TENCENT_SECRET_KEY;
        const region = process.env.TENCENT_REGION || 'ap-guangzhou';
        if (!secretId || !secretKey) {
            throw new functions.https.HttpsError('failed-precondition', 'Tencent Cloud credentials not configured (TENCENT_SECRET_ID, TENCENT_SECRET_KEY)');
        }
        return new client_3.HunyuanProvider(secretId, secretKey, region);
    }
    static createTripoProvider() {
        const apiKey = process.env.TRIPO_API_KEY;
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'Tripo API key not configured');
        }
        return new client_4.TripoProvider(apiKey);
    }
    static createHitem3DProvider() {
        const accessKey = process.env.HITEM_ACCESS_KEY;
        const secretKey = process.env.HITEM_SECRET_KEY;
        if (!accessKey || !secretKey) {
            throw new functions.https.HttpsError('failed-precondition', 'HiTem3D credentials not configured (HITEM_ACCESS_KEY, HITEM_SECRET_KEY)');
        }
        return new client_5.Hitem3DProvider(accessKey, secretKey);
    }
    /**
     * Clear cached instances (for testing)
     */
    static clearInstances() {
        this.instances.clear();
    }
}
exports.ProviderFactory = ProviderFactory;
/**
 * Helper function to get provider instance
 */
function createProvider(type = 'meshy') {
    return ProviderFactory.getProvider(type);
}
/**
 * All valid provider types
 */
const VALID_PROVIDERS = ['rodin', 'meshy', 'hunyuan', 'tripo', 'hitem3d'];
/**
 * Validate provider type
 */
function isValidProvider(provider) {
    return VALID_PROVIDERS.includes(provider);
}
//# sourceMappingURL=factory.js.map