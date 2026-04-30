<?php

use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\LogController;
use App\Http\Controllers\Api\SdkController;
use App\Http\Controllers\BillingController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::prefix('v3')->group(function () {
    Route::middleware('fivebucket.token:media')->group(function () {
        Route::get('/file', [FileController::class, 'index']);
        Route::post('/file', [FileController::class, 'uploadMultipart']);
        Route::post('/file/base64', [FileController::class, 'uploadBase64']);
        Route::get('/file/presigned-url', [FileController::class, 'createPresignedUrl']);
        Route::get('/file/{path}', [FileController::class, 'show'])->where('path', '.*');
        Route::delete('/file/{path}', [FileController::class, 'destroy'])->where('path', '.*');
    });

    Route::post('/file/presigned-url/{token}', [FileController::class, 'uploadPresigned'])->where('token', '[A-Za-z0-9_\-.]+');

    Route::middleware('fivebucket.token:logs')->group(function () {
        Route::post('/logs', [LogController::class, 'ingest']);
        Route::post('/logs/discord', [LogController::class, 'ingestDiscord']);
    });
});

Route::middleware('fivebucket.token:media')->group(function () {
    Route::post('/v2/image', [FileController::class, 'uploadMultipart']);
    Route::post('/v2/video', [FileController::class, 'uploadMultipart']);
    Route::post('/v2/audio', [FileController::class, 'uploadMultipart']);
    Route::get('/v2/presigned-url', [FileController::class, 'createPresignedUrlV2']);

    Route::delete('/image/delete/{path}', [FileController::class, 'destroy'])->where('path', '.*');
    Route::delete('/video/delete/{path}', [FileController::class, 'destroy'])->where('path', '.*');
    Route::delete('/audio/delete/{path}', [FileController::class, 'destroy'])->where('path', '.*');
});

Route::post('/v2/presigned-url/{token}', [FileController::class, 'uploadPresigned'])->where('token', '[A-Za-z0-9_\-.]+');

Route::post('/logs', [LogController::class, 'ingestLegacy'])->middleware('fivebucket.token:logs');

Route::post('/sdk/report', [SdkController::class, 'report'])->middleware('fivebucket.token:sdk');
Route::post('/sdk/heartbeat', [SdkController::class, 'heartbeat']);
Route::post('/sdk/invalidate', [SdkController::class, 'invalidate']);

Route::post('/stripe/webhook', [BillingController::class, 'webhook']);
