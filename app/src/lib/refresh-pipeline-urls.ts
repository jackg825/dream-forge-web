import { getFreshR2DownloadUrls, isR2StorageUrl } from './storage';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Pipeline, PipelineProcessedImage } from '@/types';

interface PipelineAccessProjection {
  inputImages: Array<string | null>;
  meshImages: Record<string, string | null>;
  meshUrl: string | null;
  texturedModelUrl: string | null;
}

interface RefreshPipelineAccessUrlsResponse {
  pipelines: Record<string, PipelineAccessProjection>;
  expiresAt: string;
}

async function getServerAccessUrls(
  pipelineIds: string[]
): Promise<Record<string, PipelineAccessProjection>> {
  if (!functions || pipelineIds.length === 0) return {};

  const refreshAccessUrls = httpsCallable<
    { pipelineIds: string[] },
    RefreshPipelineAccessUrlsResponse
  >(functions, 'refreshPipelineAccessUrls');
  const result = await refreshAccessUrls({ pipelineIds });
  return result.data.pipelines;
}

function collectRefreshablePaths(pipeline: Pipeline): string[] {
  return [
    ...pipeline.inputImages
      .filter((image) => isR2StorageUrl(image.url))
      .map((image) => image.storagePath),
    ...Object.values(pipeline.meshImages || {})
      .filter((image) => image && isR2StorageUrl(image.url))
      .map((image) => image?.storagePath)
      .filter((path): path is string => Boolean(path)),
    isR2StorageUrl(pipeline.meshUrl) ? pipeline.meshStoragePath : undefined,
    isR2StorageUrl(pipeline.texturedModelUrl)
      ? pipeline.texturedModelStoragePath
      : undefined,
  ].filter((path): path is string => Boolean(path));
}

function refreshedUrl(
  url: string | undefined,
  storagePath: string | undefined,
  urls: Record<string, string>
): string | undefined {
  if (!storagePath || !isR2StorageUrl(url)) return url;
  return urls[storagePath] || url;
}

function applyRefreshedUrls(
  pipeline: Pipeline,
  urls: Record<string, string>
): Pipeline {
  if (Object.keys(urls).length === 0) return pipeline;

  const meshImages = Object.fromEntries(
    Object.entries(pipeline.meshImages || {}).map(([angle, image]) => {
      if (!image) return [angle, image];
      return [angle, {
        ...image,
        url: refreshedUrl(image.url, image.storagePath, urls) || image.url,
      } as PipelineProcessedImage];
    })
  ) as Pipeline['meshImages'];

  return {
    ...pipeline,
    inputImages: pipeline.inputImages.map((image) => ({
      ...image,
      url: refreshedUrl(image.url, image.storagePath, urls) || image.url,
    })),
    meshImages,
    meshUrl: refreshedUrl(pipeline.meshUrl, pipeline.meshStoragePath, urls),
    texturedModelUrl: refreshedUrl(
      pipeline.texturedModelUrl,
      pipeline.texturedModelStoragePath,
      urls
    ),
  };
}

function applyServerAccessProjection(
  pipeline: Pipeline,
  projection: PipelineAccessProjection | undefined
): Pipeline {
  if (!projection) return pipeline;

  const meshImages = Object.fromEntries(
    Object.entries(pipeline.meshImages || {}).map(([angle, image]) => {
      if (!image) return [angle, image];
      return [angle, {
        ...image,
        url: projection.meshImages[angle] || image.url,
      } as PipelineProcessedImage];
    })
  ) as Pipeline['meshImages'];

  return {
    ...pipeline,
    inputImages: pipeline.inputImages.map((image, index) => ({
      ...image,
      url: projection.inputImages[index] || image.url,
    })),
    meshImages,
    meshUrl: projection.meshUrl || pipeline.meshUrl,
    texturedModelUrl: projection.texturedModelUrl || pipeline.texturedModelUrl,
  };
}

/**
 * Treat storage paths as durable identifiers and URLs as short-lived views.
 */
export async function refreshPipelineUrls(pipeline: Pipeline): Promise<Pipeline> {
  const [refreshedPipeline] = await refreshPipelinesUrls([pipeline]);
  return refreshedPipeline;
}

/** Refresh many history cards with one batched Worker request. */
export async function refreshPipelinesUrls(pipelines: Pipeline[]): Promise<Pipeline[]> {
  const storagePaths = pipelines.flatMap(collectRefreshablePaths);
  const [workerResult, serverResult] = await Promise.allSettled([
    getFreshR2DownloadUrls(storagePaths),
    getServerAccessUrls(pipelines.map((pipeline) => pipeline.id)),
  ]);

  if (workerResult.status === 'rejected' && serverResult.status === 'rejected') {
    throw workerResult.reason;
  }

  const workerUrls = workerResult.status === 'fulfilled' ? workerResult.value : {};
  const serverUrls = serverResult.status === 'fulfilled' ? serverResult.value : {};

  return pipelines.map((pipeline) => {
    const serverRefreshed = applyServerAccessProjection(pipeline, serverUrls[pipeline.id]);
    // Prefer Worker proxy URLs for R2 objects; they avoid depending on direct
    // bucket CORS while the server projection covers Firebase migrations.
    return applyRefreshedUrls(serverRefreshed, workerUrls);
  });
}
