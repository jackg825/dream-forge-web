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
exports.analyzeUploadedImage = exports.pollGeminiBatchJobs = exports.submitGeminiBatch = exports.startPipelineTexture = exports.checkPipelineStatus = exports.startPipelineMesh = exports.regeneratePipelineImage = exports.generatePipelineImages = exports.getUserPipelines = exports.getPipeline = exports.createPipeline = exports.uploadEditedH2CImage = exports.optimizeColorsForH2C = exports.checkSessionModelStatus = exports.startSessionModelGeneration = exports.uploadCustomView = exports.regenerateView = exports.generateSessionViews = exports.getUserSessions = exports.deleteSession = exports.updateSession = exports.getSession = exports.createSession = exports.listUsers = exports.getAdminStats = exports.checkRodinBalance = exports.setUnlimitedCredits = exports.addCredits = exports.retryFailedJob = exports.generateTexture = exports.checkJobStatus = exports.generateModel = exports.onUserCreate = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK
admin.initializeApp();
// Export all Cloud Functions
var users_1 = require("./handlers/users");
Object.defineProperty(exports, "onUserCreate", { enumerable: true, get: function () { return users_1.onUserCreate; } });
var generate_1 = require("./handlers/generate");
Object.defineProperty(exports, "generateModel", { enumerable: true, get: function () { return generate_1.generateModel; } });
Object.defineProperty(exports, "checkJobStatus", { enumerable: true, get: function () { return generate_1.checkJobStatus; } });
Object.defineProperty(exports, "generateTexture", { enumerable: true, get: function () { return generate_1.generateTexture; } });
Object.defineProperty(exports, "retryFailedJob", { enumerable: true, get: function () { return generate_1.retryFailedJob; } });
var admin_1 = require("./handlers/admin");
Object.defineProperty(exports, "addCredits", { enumerable: true, get: function () { return admin_1.addCredits; } });
Object.defineProperty(exports, "setUnlimitedCredits", { enumerable: true, get: function () { return admin_1.setUnlimitedCredits; } });
Object.defineProperty(exports, "checkRodinBalance", { enumerable: true, get: function () { return admin_1.checkRodinBalance; } });
Object.defineProperty(exports, "getAdminStats", { enumerable: true, get: function () { return admin_1.getAdminStats; } });
Object.defineProperty(exports, "listUsers", { enumerable: true, get: function () { return admin_1.listUsers; } });
// Multi-step creation flow (Sessions)
var sessions_1 = require("./handlers/sessions");
Object.defineProperty(exports, "createSession", { enumerable: true, get: function () { return sessions_1.createSession; } });
Object.defineProperty(exports, "getSession", { enumerable: true, get: function () { return sessions_1.getSession; } });
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
Object.defineProperty(exports, "getPipeline", { enumerable: true, get: function () { return pipeline_1.getPipeline; } });
Object.defineProperty(exports, "getUserPipelines", { enumerable: true, get: function () { return pipeline_1.getUserPipelines; } });
Object.defineProperty(exports, "generatePipelineImages", { enumerable: true, get: function () { return pipeline_1.generatePipelineImages; } });
Object.defineProperty(exports, "regeneratePipelineImage", { enumerable: true, get: function () { return pipeline_1.regeneratePipelineImage; } });
Object.defineProperty(exports, "startPipelineMesh", { enumerable: true, get: function () { return pipeline_1.startPipelineMesh; } });
Object.defineProperty(exports, "checkPipelineStatus", { enumerable: true, get: function () { return pipeline_1.checkPipelineStatus; } });
Object.defineProperty(exports, "startPipelineTexture", { enumerable: true, get: function () { return pipeline_1.startPipelineTexture; } });
// Gemini Batch API handlers
var gemini_batch_1 = require("./handlers/gemini-batch");
Object.defineProperty(exports, "submitGeminiBatch", { enumerable: true, get: function () { return gemini_batch_1.submitGeminiBatch; } });
Object.defineProperty(exports, "pollGeminiBatchJobs", { enumerable: true, get: function () { return gemini_batch_1.pollGeminiBatchJobs; } });
// Image analysis (pre-upload Gemini analysis)
var analyze_1 = require("./handlers/analyze");
Object.defineProperty(exports, "analyzeUploadedImage", { enumerable: true, get: function () { return analyze_1.analyzeUploadedImage; } });
//# sourceMappingURL=index.js.map