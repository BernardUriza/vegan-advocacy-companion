/**
 * Fallacy Type Definitions
 *
 * This file contains metadata for all supported fallacy types.
 * Each fallacy includes:
 * - id: Internal identifier (snake_case)
 * - name: Human-readable name
 * - definition: Clear explanation of the fallacy
 * - keywords: Common phrases that indicate this fallacy
 * - examples: Real-world examples from vegan debates
 */

export interface FallacyType {
  id: string;
  name: string;
  definition: string;
  keywords: string[];
  examples: string[];
}

export const FALLACY_TYPES: FallacyType[] = [
  {
    id: "appeal_to_tradition",
    name: "Appeal to Tradition",
    definition: "This fallacy occurs when something is justified solely because 'it's always been done this way' or 'our ancestors did it.' It assumes that historical or traditional practices are inherently correct without examining their moral merit.",
    keywords: [
      "always",
      "tradition",
      "ancestors",
      "cavemen",
      "evolved",
      "history",
      "historically",
      "for generations",
      "since ancient times",
      "our forefathers",
      "the old ways",
      "time-honored"
    ],
    examples: [
      "Humans have always eaten meat",
      "Our ancestors hunted animals",
      "It's tradition to eat turkey at Thanksgiving",
      "We evolved eating meat",
      "Cavemen ate meat, so we should too",
      "People have been eating animals for thousands of years"
    ]
  },
  {
    id: "appeal_to_nature",
    name: "Appeal to Nature",
    definition: "This fallacy assumes that because something is 'natural' it is automatically good, right, or justified. It ignores that many natural things are harmful, and many beneficial things are unnatural.",
    keywords: [
      "natural",
      "nature",
      "food chain",
      "circle of life",
      "predator",
      "prey",
      "wild",
      "instinct",
      "biologically",
      "designed to",
      "meant to",
      "intended"
    ],
    examples: [
      "Eating meat is natural",
      "We're at the top of the food chain",
      "Lions eat meat, so we should too",
      "It's the circle of life",
      "We have canine teeth, we're designed to eat meat",
      "Humans are natural omnivores"
    ]
  },
  {
    id: "ad_hominem",
    name: "Ad Hominem",
    definition: "This fallacy attacks the person making the argument rather than addressing the argument itself. It attempts to undermine the argument by discrediting the character, motive, or other attributes of the person.",
    keywords: [
      "extremist",
      "militant",
      "cult",
      "preachy",
      "pushy",
      "annoying",
      "judgmental",
      "holier-than-thou",
      "virtue signaling",
      "crazy",
      "radical",
      "hippie"
    ],
    examples: [
      "Vegans are just extremists",
      "You're being preachy and judgmental",
      "Veganism is like a cult",
      "You just want to feel superior",
      "Stop virtue signaling",
      "Vegans are annoying and pushy"
    ]
  },
  {
    id: "straw_man",
    name: "Straw Man",
    definition: "This fallacy misrepresents or exaggerates an opponent's argument to make it easier to attack. It creates a distorted version of the position that's easier to refute than the actual argument.",
    keywords: [
      "so you're saying",
      "what about",
      "you want",
      "you think",
      "you believe",
      "if everyone",
      "taken to extreme",
      "logical conclusion"
    ],
    examples: [
      "So you want everyone to starve by only eating plants?",
      "You think we should let all farm animals go extinct?",
      "If everyone went vegan, what would happen to all the cows?",
      "You want to force everyone to be vegan",
      "So you care more about animals than people?",
      "You think a carrot has the same value as a dog?"
    ]
  },
  {
    id: "false_equivalence",
    name: "False Equivalence",
    definition: "This fallacy treats two things as equivalent when they are fundamentally different. It creates a false comparison to justify an action or belief.",
    keywords: [
      "plants",
      "feel",
      "suffering",
      "same as",
      "no different",
      "equivalent",
      "just like",
      "also",
      "too",
      "as well"
    ],
    examples: [
      "Plants feel pain too",
      "Killing a plant is the same as killing an animal",
      "Plants also suffer when you harvest them",
      "What's the difference between a carrot and a cow?",
      "Vegans kill plants, which is just as bad",
      "You're causing plant suffering"
    ]
  }
];

/**
 * Get fallacy metadata by ID
 */
export function getFallacyById(id: string): FallacyType | undefined {
  return FALLACY_TYPES.find(f => f.id === id);
}

/**
 * Get all fallacy IDs
 */
export function getAllFallacyIds(): string[] {
  return FALLACY_TYPES.map(f => f.id);
}

/**
 * Validate if a fallacy type exists
 */
export function isValidFallacyType(id: string): boolean {
  return FALLACY_TYPES.some(f => f.id === id);
}
