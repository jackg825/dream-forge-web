/**
 * Generate Style Example Images using Gemini 2.5 Flash Image
 *
 * This script generates preview images for each figure style (bobblehead, chibi, cartoon, emoji)
 * using the Gemini image generation API.
 *
 * Usage:
 *   npx tsx scripts/generate-style-examples.ts --api-key=YOUR_GEMINI_API_KEY
 *
 * Output:
 *   Saves 6 images per style to app/public/styles/{styleName}/preview-{1-6}.jpg
 */

import * as fs from 'fs';
import * as path from 'path';

// Gemini API configuration
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.5-flash-image';

// Output directory (relative to project root)
const OUTPUT_DIR = path.join(__dirname, '..', 'app', 'public', 'styles');

// Delay between API calls to avoid rate limiting (ms)
const DELAY_BETWEEN_CALLS = 2000;

// Style configurations with prompt modifiers
interface StyleConfig {
  id: string;
  name: string;
  promptModifiers: {
    meshStyle: string;
    textureStyle: string;
    proportions: string;
    features: string;
  };
}

// Type for Gemini response content parts
interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: ContentPart[];
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
  };
}

const STYLE_CONFIGS: Record<string, StyleConfig> = {
  bobblehead: {
    id: 'bobblehead',
    name: 'Bobblehead',
    promptModifiers: {
      meshStyle:
        'Transform into a classic bobblehead collectible figure. ' +
        'The head should be dramatically oversized (3-4 times larger than body). ' +
        'Thin cylindrical neck connection (like a spring mount). ' +
        'Small compact body with simplified limbs. ' +
        'Flat circular base for stability. ' +
        'Smooth vinyl toy finish with subtle glossy sheen.',
      textureStyle:
        'Bobblehead vinyl toy texture. ' +
        'Clean solid colors with slight plastic sheen. ' +
        'Simplified facial features - large eyes, friendly expression. ' +
        'No fabric textures - all surfaces appear as smooth vinyl.',
      proportions:
        'Head: 3-4x body size. ' +
        'Neck: Thin cylindrical spring mount. ' +
        'Body: Compact, 1/3 to 1/4 of total height. ' +
        'Base: Flat circular platform.',
      features:
        'Emphasize facial features and hair. ' +
        'Simplify body details. ' +
        'Exaggerate distinctive characteristics (glasses, hat, etc). ' +
        'Round all edges for toy-safe appearance.',
    },
  },
  chibi: {
    id: 'chibi',
    name: 'Chibi',
    promptModifiers: {
      meshStyle:
        'Transform into an adorable chibi anime figure. ' +
        'Head is 2-3 times larger than body (classic 2-3 head proportion). ' +
        'Large sparkly anime eyes taking up 1/3 of face. ' +
        'Tiny stubby limbs with rounded hands and feet. ' +
        'Soft rounded forms throughout - no sharp edges. ' +
        'Optional: subtle blush marks on cheeks.',
      textureStyle:
        'Chibi anime figure texture. ' +
        'Smooth matte finish like quality anime figurines. ' +
        'Large expressive eyes with highlights. ' +
        'Soft gradients on skin and hair. ' +
        'Clean cel-shaded appearance.',
      proportions:
        'Head: 2-3x body size (2-3 head tall total). ' +
        'Eyes: Large, 1/3 of face height. ' +
        'Body: Stubby, rounded. ' +
        'Limbs: Short and thick.',
      features:
        'Focus on cute expression and large eyes. ' +
        'Simplify clothing details. ' +
        'Add blush marks for extra cuteness. ' +
        'Hair should be stylized but recognizable.',
    },
  },
  cartoon: {
    id: 'cartoon',
    name: 'Cartoon',
    promptModifiers: {
      meshStyle:
        'Transform into a stylized 3D cartoon character (Pixar/Disney style). ' +
        'Slightly exaggerated proportions (head 1.5-2x normal). ' +
        'Expressive pose with personality. ' +
        'Dynamic silhouette with clear gesture. ' +
        'Smooth stylized forms, not realistic. ' +
        'Clean topology suitable for animation.',
      textureStyle:
        'Cartoon character texture (Pixar/Disney quality). ' +
        'Vibrant saturated colors. ' +
        'Soft subsurface scattering on skin. ' +
        'Stylized but detailed - not flat. ' +
        'Expressive eyes with subtle reflections.',
      proportions:
        'Head: 1.5-2x realistic proportions. ' +
        'Body: Stylized but functional. ' +
        'Hands: Slightly large for expressiveness. ' +
        'Overall: Appeal and personality over realism.',
      features:
        'Capture personality and expression. ' +
        'Exaggerate defining characteristics. ' +
        'Clear silhouette readable from any angle. ' +
        'Dynamic pose if appropriate.',
    },
  },
  emoji: {
    id: 'emoji',
    name: 'Emoji',
    promptModifiers: {
      meshStyle:
        'Transform into an emoji-style 3D figure. ' +
        'The head IS the body - spherical or pill-shaped form. ' +
        'Extremely simplified: face on a round shape. ' +
        'Tiny or no limbs (small hands/feet if needed). ' +
        'Maximum 3-4 colors total. ' +
        'Clean geometric forms, no complex details.',
      textureStyle:
        'Emoji flat texture style. ' +
        'Solid flat colors, no gradients. ' +
        'Bold simple shapes for features. ' +
        'High contrast - yellow, black, red typical. ' +
        'Clean vector-like appearance.',
      proportions:
        'Head/Body: Merged into single spherical form. ' +
        'Features: Minimal, iconic. ' +
        'Limbs: Optional, very small if present. ' +
        'Overall: Icon-like simplicity.',
      features:
        'Focus ONLY on expression. ' +
        'Remove all unnecessary details. ' +
        'Use iconic shapes (circles, curves). ' +
        'Maximum recognizability at small sizes.',
    },
  },
};

// Diverse subjects for generating example images
const SUBJECTS = [
  {
    description: 'a young cowboy with blonde curly hair wearing a brown cowboy hat, white t-shirt, and brown leather chaps with fringe',
    gender: 'male',
    age: 'young adult',
  },
  {
    description: 'a Japanese schoolgirl with short brown hair, wearing a sailor uniform with a plaid skirt',
    gender: 'female',
    age: 'teenager',
  },
  {
    description: 'a professional businesswoman with elegant brown hair in a beige dress carrying a designer handbag',
    gender: 'female',
    age: 'adult',
  },
  {
    description: 'Abraham Lincoln in his iconic black suit with a bow tie, tall and distinguished with his famous beard',
    gender: 'male',
    age: 'historical figure',
  },
  {
    description: 'a distinguished older gentleman with grey hair and beard wearing a light blue summer suit with a straw hat',
    gender: 'male',
    age: 'senior',
  },
  {
    description: 'a young professional woman with brown wavy hair wearing sunglasses, white blouse and beige pants',
    gender: 'female',
    age: 'young adult',
  },
];

/**
 * Parse command line arguments
 */
function parseArgs(): { apiKey: string } {
  const args = process.argv.slice(2);
  let apiKey = '';

  for (const arg of args) {
    if (arg.startsWith('--api-key=')) {
      apiKey = arg.substring('--api-key='.length);
    }
  }

  if (!apiKey) {
    console.error('Error: API key is required');
    console.error('Usage: npx tsx scripts/generate-style-examples.ts --api-key=YOUR_GEMINI_API_KEY');
    process.exit(1);
  }

  return { apiKey };
}

/**
 * Build the prompt for generating a style example image
 */
function buildPrompt(style: StyleConfig, subject: typeof SUBJECTS[0]): string {
  const { meshStyle, textureStyle, proportions, features } = style.promptModifiers;

  return `Generate a full-body 3D figure character illustration.

SUBJECT: ${subject.description}

STYLE TRANSFORMATION:
${meshStyle}

TEXTURE AND APPEARANCE:
${textureStyle}

PROPORTIONS:
${proportions}

FEATURE EMPHASIS:
${features}

REQUIREMENTS:
- Full body view, standing pose
- Pure white background (#FFFFFF)
- Character centered in frame
- High quality 3D render appearance
- Cute and appealing character design
- Professional figurine/collectible quality
- Square aspect ratio (1:1)
- Character fills about 85% of the frame vertically

Generate a single image of this ${style.name} style figure.`;
}

/**
 * Generate a single image using Gemini API (using native fetch)
 */
async function generateImage(
  apiKey: string,
  prompt: string
): Promise<string | null> {
  const url = `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  HTTP Error ${response.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const data = (await response.json()) as GeminiResponse;

    // Check for API errors
    if (data.error) {
      console.error(`  API Error: ${data.error.message}`);
      return null;
    }

    // Extract image from response
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) {
      console.error('  No content in response');
      return null;
    }

    const parts = candidate.content.parts;
    const imagePart = parts.find((p: ContentPart) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      const textPart = parts.find((p: ContentPart) => p.text);
      console.error(`  No image generated. Response: ${textPart?.text?.substring(0, 200) || 'No text'}`);
      return null;
    }

    return imagePart.inlineData.data;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('  Request timed out after 2 minutes');
      } else {
        console.error(`  Request failed: ${error.message}`);
      }
    } else {
      console.error(`  Error: ${String(error)}`);
    }
    return null;
  }
}

/**
 * Save base64 image to file
 */
function saveImage(base64Data: string, outputPath: string): void {
  const buffer = Buffer.from(base64Data, 'base64');
  const dir = path.dirname(outputPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Style Example Image Generator');
  console.log('Using Gemini 2.5 Flash Image');
  console.log('='.repeat(60));
  console.log();

  const { apiKey } = parseArgs();

  const styles = Object.values(STYLE_CONFIGS);
  const totalImages = styles.length * SUBJECTS.length;
  let generatedCount = 0;
  let failedCount = 0;

  console.log(`Generating ${totalImages} images (${styles.length} styles x ${SUBJECTS.length} subjects)`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log();

  for (const style of styles) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Style: ${style.name} (${style.id})`);
    console.log('─'.repeat(50));

    const styleDir = path.join(OUTPUT_DIR, style.id);

    for (let i = 0; i < SUBJECTS.length; i++) {
      const subject = SUBJECTS[i];
      const imageNum = i + 1;
      const outputPath = path.join(styleDir, `preview-${imageNum}.jpg`);

      console.log(`\n[${generatedCount + failedCount + 1}/${totalImages}] Generating preview-${imageNum}.jpg...`);
      console.log(`  Subject: ${subject.description.substring(0, 50)}...`);

      const prompt = buildPrompt(style, subject);
      const imageData = await generateImage(apiKey, prompt);

      if (imageData) {
        saveImage(imageData, outputPath);
        console.log(`  Saved: ${outputPath}`);
        generatedCount++;
      } else {
        console.log(`  FAILED to generate image`);
        failedCount++;
      }

      // Rate limiting delay (except for last image)
      if (generatedCount + failedCount < totalImages) {
        console.log(`  Waiting ${DELAY_BETWEEN_CALLS}ms before next request...`);
        await delay(DELAY_BETWEEN_CALLS);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Generation Complete!');
  console.log('='.repeat(60));
  console.log(`  Total: ${totalImages}`);
  console.log(`  Generated: ${generatedCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log();

  if (failedCount > 0) {
    console.log('Some images failed to generate. You may want to run the script again.');
    process.exit(1);
  }
}

// Run the script
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Fatal error:', message);
  process.exit(1);
});
