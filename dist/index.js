"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideo = exports.generateSpeech = exports.analyzeCode = exports.Config = void 0;
// src/index.ts
var config_1 = require("./config");
Object.defineProperty(exports, "Config", { enumerable: true, get: function () { return config_1.Config; } });
var codeAnalyzer_1 = require("./codeAnalyzer");
Object.defineProperty(exports, "analyzeCode", { enumerable: true, get: function () { return codeAnalyzer_1.analyzeCode; } });
var textToSpeech_1 = require("./textToSpeech");
Object.defineProperty(exports, "generateSpeech", { enumerable: true, get: function () { return textToSpeech_1.generateSpeech; } });
var videoGenerator_1 = require("./videoGenerator");
Object.defineProperty(exports, "generateVideo", { enumerable: true, get: function () { return videoGenerator_1.generateVideo; } });
