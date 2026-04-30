<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Models\MediaFile;
use App\Models\Team;
use App\Services\FiveBucketStorage;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class FileController extends Controller
{
    public function __construct(private readonly FiveBucketStorage $storage)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return $this->execute(function () use ($request) {
            $team = $this->team($request);
            $limit = min(max((int) $request->query('limit', 50), 1), 100);
            $page = max((int) $request->query('page', 1), 1);

            $query = MediaFile::query()
                ->where('team_id', $team->id)
                ->latest();

            if ($request->filled('type')) {
                $query->where('type', $request->query('type'));
            }

            if ($request->filled('path')) {
                $query->where('path', trim((string) $request->query('path'), '/'));
            }

            $files = $query->paginate($limit, ['*'], 'page', $page);

            return $this->ok([
                'data' => $files->getCollection()->map->compatibilityPayload()->values(),
                'pagination' => [
                    'limit' => $files->perPage(),
                    'page' => $files->currentPage(),
                    'total' => $files->total(),
                ],
            ]);
        });
    }

    public function uploadMultipart(Request $request): JsonResponse
    {
        return $this->execute(function () use ($request) {
            $file = $this->uploadedFile($request);

            if (! $file) {
                return $this->error('The file field is required.', 400);
            }

            $mediaFile = $this->storage->storeUploadedFile(
                $this->team($request),
                $this->apiToken($request),
                $file,
                $this->uploadOptions($request)
            );

            return $this->ok(['data' => $this->uploadPayload($mediaFile)]);
        });
    }

    public function uploadBase64(Request $request): JsonResponse
    {
        return $this->execute(function () use ($request) {
            if (! $request->filled('base64')) {
                return $this->error('The base64 field is required.', 400);
            }

            $mediaFile = $this->storage->storeBase64(
                $this->team($request),
                $this->apiToken($request),
                (string) $request->input('base64'),
                $this->uploadOptions($request)
            );

            return $this->ok(['data' => $this->uploadPayload($mediaFile)]);
        });
    }

    public function createPresignedUrl(Request $request): JsonResponse
    {
        return $this->execute(function () use ($request) {
            return $this->ok([
                'data' => [
                    'presignedUrl' => $this->storage->createPresignedUrl(
                        $this->team($request),
                        $this->apiToken($request),
                        $request->query('expiresAt') ? (int) $request->query('expiresAt') : null
                    ),
                ],
            ]);
        });
    }

    public function createPresignedUrlV2(Request $request): JsonResponse
    {
        return $this->execute(function () use ($request) {
            return $this->ok([
                'data' => [
                    'presignedUrl' => $this->storage->createPresignedUrl(
                        $this->team($request),
                        $this->apiToken($request),
                        $request->query('expiresAt') ? (int) $request->query('expiresAt') : null,
                        $request->query('fileType'),
                        '/api/v2/presigned-url'
                    ),
                ],
            ]);
        });
    }

    public function uploadPresigned(Request $request, string $token): JsonResponse
    {
        return $this->execute(function () use ($request, $token) {
            [$team, $apiToken] = $this->storage->resolvePresignedToken($token);
            $file = $this->uploadedFile($request);

            if (! $file) {
                return $this->error('The file field is required.', 400);
            }

            $mediaFile = $this->storage->storeUploadedFile($team, $apiToken, $file, $this->uploadOptions($request));

            return $this->ok(['data' => $this->uploadPayload($mediaFile)]);
        });
    }

    public function show(Request $request, string $path): JsonResponse
    {
        return $this->execute(function () use ($request, $path) {
            $file = $this->storage->findForTeam($this->team($request), $path);

            if (! $file) {
                return $this->error('File not found.', 404);
            }

            return $this->ok(['data' => $file->compatibilityPayload()]);
        });
    }

    public function destroy(Request $request, string $path): JsonResponse
    {
        return $this->execute(function () use ($request, $path) {
            $file = $this->storage->findForTeam($this->team($request), $path);

            if (! $file) {
                return $this->error('File not found.', 404);
            }

            $this->storage->delete($file);

            return $this->ok();
        });
    }

    private function uploadedFile(Request $request): mixed
    {
        return $request->file('file')
            ?? $request->file('image')
            ?? $request->file('video')
            ?? $request->file('audio');
    }

    private function uploadOptions(Request $request): array
    {
        return [
            'filename' => $request->input('filename'),
            'path' => $request->input('path'),
            'metadata' => $request->input('metadata'),
            'retentionExempt' => $request->input('retentionExempt'),
            'retention_exempt' => $request->input('retention_exempt'),
        ];
    }

    private function team(Request $request): Team
    {
        return $request->attributes->get('fivebucket_team');
    }

    private function apiToken(Request $request): ?ApiToken
    {
        return $request->attributes->get('fivebucket_api_token');
    }

    private function uploadPayload(MediaFile $file): array
    {
        return [
            'id' => $file->public_id,
            'url' => $file->url,
            'originalUrl' => $file->original_url ?? $file->url,
        ];
    }

    private function ok(array $payload = []): JsonResponse
    {
        return response()->json(array_merge($payload, ['status' => 'ok']));
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => $message,
        ], $status);
    }

    private function execute(callable $callback): JsonResponse
    {
        try {
            return $callback();
        } catch (HttpExceptionInterface $exception) {
            return $this->error($exception->getMessage() ?: Response::$statusTexts[$exception->getStatusCode()], $exception->getStatusCode());
        } catch (ModelNotFoundException) {
            return $this->error('Resource not found.', 404);
        } catch (Throwable $exception) {
            report($exception);

            return $this->error('Internal server error.', 500);
        }
    }
}
