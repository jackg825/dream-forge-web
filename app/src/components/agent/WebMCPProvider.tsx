'use client';

import { useEffect } from 'react';

type JsonObject = Record<string, unknown>;

interface WebMCPTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonObject;
  execute: (input: JsonObject) => Promise<unknown> | unknown;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
}

interface WebMCPContext {
  registerTool?: (tool: WebMCPTool, options?: { signal?: AbortSignal }) => void;
  provideContext?: (
    context: { tools: WebMCPTool[] },
    options?: { signal?: AbortSignal }
  ) => void;
}

declare global {
  interface Navigator {
    modelContext?: WebMCPContext;
  }
}

const SITE_URL = 'https://dreamforge.app';
const LOCALES = ['zh-TW', 'en'] as const;
type Locale = (typeof LOCALES)[number];

function getCurrentLocale(): Locale {
  const pathLocale = window.location.pathname.split('/').filter(Boolean)[0];
  if (pathLocale === 'en' || pathLocale === 'zh-TW') {
    return pathLocale;
  }

  return document.documentElement.lang === 'en' ? 'en' : 'zh-TW';
}

function normalizeLocale(value: unknown): Locale {
  return value === 'en' || value === 'zh-TW' ? value : getCurrentLocale();
}

function localizedUrl(locale: Locale, path: string): string {
  return `${SITE_URL}/${locale}${path}`;
}

function buildTools(): WebMCPTool[] {
  return [
    {
      name: 'dreamforge.get_site_summary',
      title: 'Get Dream Forge Site Summary',
      description:
        'Return Dream Forge capabilities, public URLs, discovery resources, and agent policy notes.',
      inputSchema: {
        type: 'object',
        properties: {
          locale: {
            type: 'string',
            enum: LOCALES,
            description: 'Preferred locale for returned entry-point URLs.',
          },
        },
        additionalProperties: false,
      },
      execute: (input) => {
        const locale = normalizeLocale(input.locale);

        return {
          name: 'Dream Forge',
          description:
            'AI-powered photo-to-3D model creation for digital art, games, collectibles, and 3D printing.',
          capabilities: [
            'single-photo 3D model generation',
            'multi-view and AI-generated supporting views',
            'style presets including bobblehead, chibi, cartoon, and emoji',
            'browser model preview, downloads, and print-order workflows',
          ],
          urls: {
            home: localizedUrl(locale, '/'),
            create: localizedUrl(locale, '/generate/'),
            signIn: localizedUrl(locale, '/auth/'),
            apiCatalog: `${SITE_URL}/.well-known/api-catalog`,
            apiDocs: `${SITE_URL}/docs/api/`,
            sitemap: `${SITE_URL}/sitemap.xml`,
          },
          contentPolicy: {
            aiTrain: false,
            search: true,
            aiInput: true,
          },
        };
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    {
      name: 'dreamforge.start_creation',
      title: 'Start 3D Model Creation',
      description:
        'Navigate the user to the localized Dream Forge creation flow for turning photos into 3D models.',
      inputSchema: {
        type: 'object',
        properties: {
          locale: {
            type: 'string',
            enum: LOCALES,
            description: 'Locale to use for the creation flow.',
          },
        },
        additionalProperties: false,
      },
      execute: (input) => {
        const locale = normalizeLocale(input.locale);
        const targetUrl = localizedUrl(locale, '/generate/');
        window.location.assign(targetUrl);

        return {
          navigatedTo: targetUrl,
        };
      },
    },
    {
      name: 'dreamforge.get_pricing_summary',
      title: 'Get Dream Forge Pricing Summary',
      description:
        'Return a concise summary of free and premium capabilities for Dream Forge model generation.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: () => ({
        free: {
          viewGenerationModels: ['Gemini 2.5 Flash'],
          providers: ['HiTem3D'],
          hitem3dResolutions: ['512'],
        },
        premium: {
          viewGenerationModels: ['Gemini 2.5 Flash', 'Gemini 3 Pro'],
          providers: ['Hunyuan', 'Tripo', 'HiTem3D'],
          hitem3dResolutions: ['512', '1024'],
        },
        docs: `${SITE_URL}/docs/api/`,
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    {
      name: 'dreamforge.get_discovery_resources',
      title: 'Get Dream Forge Discovery Resources',
      description:
        'Return machine-readable discovery URLs for API catalogs, agent skills, MCP server card, robots, and sitemap.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: () => ({
        robots: `${SITE_URL}/robots.txt`,
        sitemap: `${SITE_URL}/sitemap.xml`,
        markdown: `${SITE_URL}/index.md`,
        apiCatalog: `${SITE_URL}/.well-known/api-catalog`,
        openApi: `${SITE_URL}/.well-known/openapi.json`,
        oauthProtectedResource: `${SITE_URL}/.well-known/oauth-protected-resource`,
        agentSkills: `${SITE_URL}/.well-known/agent-skills/index.json`,
        mcpServerCard: `${SITE_URL}/.well-known/mcp/server-card.json`,
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
  ];
}

export function WebMCPProvider() {
  useEffect(() => {
    const modelContext = navigator.modelContext;
    if (!modelContext) {
      return;
    }

    const controller = new AbortController();
    const tools = buildTools();

    try {
      if (typeof modelContext.registerTool === 'function') {
        for (const tool of tools) {
          modelContext.registerTool(tool, { signal: controller.signal });
        }
      } else if (typeof modelContext.provideContext === 'function') {
        modelContext.provideContext({ tools }, { signal: controller.signal });
      }
    } catch (error) {
      console.warn('Unable to register Dream Forge WebMCP tools', error);
    }

    return () => {
      controller.abort();
    };
  }, []);

  return null;
}
