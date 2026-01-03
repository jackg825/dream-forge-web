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
exports.listAllOrders = exports.getPrintConfig = exports.deleteShippingAddress = exports.saveShippingAddress = exports.getShippingAddresses = exports.cancelOrder = exports.getOrderDetails = exports.getUserOrders = exports.createOrder = exports.analyzeMeshForPrint = exports.optimizeMeshForPrint = exports.analyzeUploadedImage = exports.submitGeminiBatch = exports.resetPipelineStep = exports.updatePipelineAnalysis = exports.startPipelineTexture = exports.checkPipelineStatus = exports.startPipelineMesh = exports.regeneratePipelineImage = exports.generatePipelineImages = exports.createPipeline = exports.uploadEditedH2CImage = exports.optimizeColorsForH2C = exports.checkSessionModelStatus = exports.startSessionModelGeneration = exports.uploadCustomView = exports.regenerateView = exports.generateSessionViews = exports.getUserSessions = exports.deleteSession = exports.updateSession = exports.createSession = exports.adminRejectPreview = exports.adminConfirmPreview = exports.adminCheckPreviewStatus = exports.adminStartPipelineMesh = exports.adminRegeneratePipelineImage = exports.updateUserTier = exports.getUserTransactions = exports.deductCredits = exports.listAllPipelines = exports.listUsers = exports.getAdminStats = exports.checkAllProviderBalances = exports.checkRodinBalance = exports.addCredits = exports.retryFailedJob = exports.checkJobStatus = exports.generateModel = exports.onUserCreate = void 0;
exports.updatePricing = exports.updateMaterialConfig = exports.getOrderStats = exports.updateTrackingInfo = exports.updateOrderStatus = exports.getOrdersByStatus = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK
admin.initializeApp();
// Export all Cloud Functions
var users_1 = require("./handlers/users");
Object.defineProperty(exports, "onUserCreate", { enumerable: true, get: function () { return users_1.onUserCreate; } });
var generate_1 = require("./handlers/generate");
Object.defineProperty(exports, "generateModel", { enumerable: true, get: function () { return generate_1.generateModel; } });
Object.defineProperty(exports, "checkJobStatus", { enumerable: true, get: function () { return generate_1.checkJobStatus; } });
Object.defineProperty(exports, "retryFailedJob", { enumerable: true, get: function () { return generate_1.retryFailedJob; } });
var admin_1 = require("./handlers/admin");
Object.defineProperty(exports, "addCredits", { enumerable: true, get: function () { return admin_1.addCredits; } });
Object.defineProperty(exports, "checkRodinBalance", { enumerable: true, get: function () { return admin_1.checkRodinBalance; } });
Object.defineProperty(exports, "checkAllProviderBalances", { enumerable: true, get: function () { return admin_1.checkAllProviderBalances; } });
Object.defineProperty(exports, "getAdminStats", { enumerable: true, get: function () { return admin_1.getAdminStats; } });
Object.defineProperty(exports, "listUsers", { enumerable: true, get: function () { return admin_1.listUsers; } });
Object.defineProperty(exports, "listAllPipelines", { enumerable: true, get: function () { return admin_1.listAllPipelines; } });
Object.defineProperty(exports, "deductCredits", { enumerable: true, get: function () { return admin_1.deductCredits; } });
Object.defineProperty(exports, "getUserTransactions", { enumerable: true, get: function () { return admin_1.getUserTransactions; } });
Object.defineProperty(exports, "updateUserTier", { enumerable: true, get: function () { return admin_1.updateUserTier; } });
// Admin pipeline regeneration functions
Object.defineProperty(exports, "adminRegeneratePipelineImage", { enumerable: true, get: function () { return admin_1.adminRegeneratePipelineImage; } });
Object.defineProperty(exports, "adminStartPipelineMesh", { enumerable: true, get: function () { return admin_1.adminStartPipelineMesh; } });
Object.defineProperty(exports, "adminCheckPreviewStatus", { enumerable: true, get: function () { return admin_1.adminCheckPreviewStatus; } });
Object.defineProperty(exports, "adminConfirmPreview", { enumerable: true, get: function () { return admin_1.adminConfirmPreview; } });
Object.defineProperty(exports, "adminRejectPreview", { enumerable: true, get: function () { return admin_1.adminRejectPreview; } });
// Multi-step creation flow (Sessions)
var sessions_1 = require("./handlers/sessions");
Object.defineProperty(exports, "createSession", { enumerable: true, get: function () { return sessions_1.createSession; } });
Object.defineProperty(exports, "updateSession", { enumerable: true, get: function () { return sessions_1.updateSession; } });
Object.defineProperty(exports, "deleteSession", { enumerable: true, get: function () { return sessions_1.deleteSession; } });
Object.defineProperty(exports, "getUserSessions", { enumerable: true, get: function () { return sessions_1.getUserSessions; } });
// Multi-step creation flow (Views)
var views_1 = require("./handlers/views");
Object.defineProperty(exports, "generateSessionViews", { enumerable: true, get: function () { return views_1.generateSessionViews; } });
Object.defineProperty(exports, "regenerateView", { enumerable: true, get: function () { return views_1.regenerateView; } });
Object.defineProperty(exports, "uploadCustomView", { enumerable: true, get: function () { return views_1.uploadCustomView; } });
// Multi-step creation flow (Model)
var model_1 = require("./handlers/model");
Object.defineProperty(exports, "startSessionModelGeneration", { enumerable: true, get: function () { return model_1.startSessionModelGeneration; } });
Object.defineProperty(exports, "checkSessionModelStatus", { enumerable: true, get: function () { return model_1.checkSessionModelStatus; } });
// H2C 7-color optimization for Bambu Lab H2C printer
var h2c_1 = require("./handlers/h2c");
Object.defineProperty(exports, "optimizeColorsForH2C", { enumerable: true, get: function () { return h2c_1.optimizeColorsForH2C; } });
Object.defineProperty(exports, "uploadEditedH2CImage", { enumerable: true, get: function () { return h2c_1.uploadEditedH2CImage; } });
// New simplified pipeline flow (Gemini + Meshy)
var pipeline_1 = require("./handlers/pipeline");
Object.defineProperty(exports, "createPipeline", { enumerable: true, get: function () { return pipeline_1.createPipeline; } });
Object.defineProperty(exports, "generatePipelineImages", { enumerable: true, get: function () { return pipeline_1.generatePipelineImages; } });
Object.defineProperty(exports, "regeneratePipelineImage", { enumerable: true, get: function () { return pipeline_1.regeneratePipelineImage; } });
Object.defineProperty(exports, "startPipelineMesh", { enumerable: true, get: function () { return pipeline_1.startPipelineMesh; } });
Object.defineProperty(exports, "checkPipelineStatus", { enumerable: true, get: function () { return pipeline_1.checkPipelineStatus; } });
Object.defineProperty(exports, "startPipelineTexture", { enumerable: true, get: function () { return pipeline_1.startPipelineTexture; } });
Object.defineProperty(exports, "updatePipelineAnalysis", { enumerable: true, get: function () { return pipeline_1.updatePipelineAnalysis; } });
Object.defineProperty(exports, "resetPipelineStep", { enumerable: true, get: function () { return pipeline_1.resetPipelineStep; } });
// Gemini Batch API handlers
var gemini_batch_1 = require("./handlers/gemini-batch");
Object.defineProperty(exports, "submitGeminiBatch", { enumerable: true, get: function () { return gemini_batch_1.submitGeminiBatch; } });
// Image analysis (pre-upload Gemini analysis)
var analyze_1 = require("./handlers/analyze");
Object.defineProperty(exports, "analyzeUploadedImage", { enumerable: true, get: function () { return analyze_1.analyzeUploadedImage; } });
// 3D Print mesh optimization
var optimize_1 = require("./handlers/optimize");
Object.defineProperty(exports, "optimizeMeshForPrint", { enumerable: true, get: function () { return optimize_1.optimizeMeshForPrint; } });
Object.defineProperty(exports, "analyzeMeshForPrint", { enumerable: true, get: function () { return optimize_1.analyzeMeshForPrint; } });
// Print ordering system
var orders_1 = require("./handlers/orders");
// User functions
Object.defineProperty(exports, "createOrder", { enumerable: true, get: function () { return orders_1.createOrder; } });
Object.defineProperty(exports, "getUserOrders", { enumerable: true, get: function () { return orders_1.getUserOrders; } });
Object.defineProperty(exports, "getOrderDetails", { enumerable: true, get: function () { return orders_1.getOrderDetails; } });
Object.defineProperty(exports, "cancelOrder", { enumerable: true, get: function () { return orders_1.cancelOrder; } });
// Shipping addresses
Object.defineProperty(exports, "getShippingAddresses", { enumerable: true, get: function () { return orders_1.getShippingAddresses; } });
Object.defineProperty(exports, "saveShippingAddress", { enumerable: true, get: function () { return orders_1.saveShippingAddress; } });
Object.defineProperty(exports, "deleteShippingAddress", { enumerable: true, get: function () { return orders_1.deleteShippingAddress; } });
// Print config
Object.defineProperty(exports, "getPrintConfig", { enumerable: true, get: function () { return orders_1.getPrintConfig; } });
// Admin functions
Object.defineProperty(exports, "listAllOrders", { enumerable: true, get: function () { return orders_1.listAllOrders; } });
Object.defineProperty(exports, "getOrdersByStatus", { enumerable: true, get: function () { return orders_1.getOrdersByStatus; } });
Object.defineProperty(exports, "updateOrderStatus", { enumerable: true, get: function () { return orders_1.updateOrderStatus; } });
Object.defineProperty(exports, "updateTrackingInfo", { enumerable: true, get: function () { return orders_1.updateTrackingInfo; } });
Object.defineProperty(exports, "getOrderStats", { enumerable: true, get: function () { return orders_1.getOrderStats; } });
Object.defineProperty(exports, "updateMaterialConfig", { enumerable: true, get: function () { return orders_1.updateMaterialConfig; } });
Object.defineProperty(exports, "updatePricing", { enumerable: true, get: function () { return orders_1.updatePricing; } });
//# sourceMappingURL=index.js.map