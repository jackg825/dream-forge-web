# Dream Forge Prompt Evaluation

Use this rubric before changing production Gemini prompts or model routing. Static
contract tests run without API cost; visual evaluation uses a fixed reference set
and records model, prompt version, latency, and estimated cost.

## Reference Set

Keep the same consented or license-safe images across comparisons. The minimum
set is 12 subjects:

1. Front-facing person with distinctive hair and glasses.
2. Three-quarter-view person with asymmetric clothing.
3. Plush animal with ears, tail, and soft texture.
4. Hard-surface toy vehicle with bilateral symmetry.
5. Product with a single asymmetric handle.
6. Object with thin protrusions or antennae.
7. Dark object on a dark or cluttered background.
8. Glossy or reflective object.
9. Translucent object.
10. Top-down reference image.
11. Multiple uploaded views of the same subject.
12. Subject that does not naturally fit the selected figure style.

Do not add private production uploads to the set without explicit consent.

## Hard Gates

A run fails if any generated set has one of these defects:

- Missing front, back, left, or right output.
- Face visible in the back view.
- Left/right views mirrored relative to the prompt contract.
- A second subject, label, grid fragment, or background object appears.
- Identity, accessories, or major colors change between views.
- Output cannot be decoded, cropped, or accepted by the selected 3D provider.
- A model other than the UI-selected model is billed or logged.

## Scoring

Score each dimension from 1 (unusable) to 5 (excellent):

| Dimension | Weight | What to inspect |
| --- | ---: | --- |
| View correctness | 20% | Orthographic angle, left/right orientation, back visibility |
| Identity consistency | 20% | Proportions, face, accessories, distinctive marks |
| Source fidelity | 15% | Recognizability and preservation of requested details |
| Style adherence | 10% | Selected style applied without unrequested transformation |
| Color consistency | 10% | Stable palette and material appearance across views |
| 3D reconstruction utility | 15% | Clean silhouette, isolation, readable depth, no occlusion |
| Print readiness | 10% | Thickened fragile details, connected parts, manageable overhangs |

The weighted mean must be at least 4.0, no individual dimension may be below
3, and all hard gates must pass.

## Run Record

Record one JSON object per subject and variant:

```json
{
  "promptVersion": "git-sha-or-release-label",
  "model": "gemini-2.5-flash-image",
  "style": "none",
  "mode": "simplified-mesh",
  "subjectId": "asymmetric-handle-01",
  "latencyMs": 0,
  "estimatedCostUsd": 0,
  "hardGateFailures": [],
  "scores": {
    "viewCorrectness": 0,
    "identityConsistency": 0,
    "sourceFidelity": 0,
    "styleAdherence": 0,
    "colorConsistency": 0,
    "reconstructionUtility": 0,
    "printReadiness": 0
  },
  "notes": ""
}
```

## Comparison Protocol

1. Change one variable at a time: model, prompt, mode, or style routing.
2. Run the static prompt contracts with `npm --prefix functions run test:prompts`.
3. Generate the full reference set for both control and candidate.
4. Blind the reviewer to variant names when practical.
5. Compare hard gates, weighted scores, latency, retry rate, and cost.
6. Promote only when the candidate passes every hard gate and improves quality
   without an unaccepted cost or latency regression.
