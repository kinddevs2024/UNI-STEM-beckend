// Rule-based portfolio generator from text
// No external AI API - uses keyword matching and presets

// Default section templates
const SECTION_TEMPLATES = {
  about: {
    type: "about",
    title: "About Me",
    content: "",
    order: 1,
  },
  education: {
    type: "education",
    title: "Education",
    items: [],
    order: 2,
  },
  achievements: {
    type: "achievements",
    title: "Achievements",
    items: [],
    order: 3,
  },
  projects: {
    type: "projects",
    title: "Projects",
    items: [],
    order: 4,
  },
  certificates: {
    type: "certificates",
    title: "Certificates",
    items: [],
    order: 5,
  },
  skills: {
    type: "skills",
    title: "Skills",
    items: [],
    order: 6,
  },
  contact: {
    type: "contact",
    title: "Contact",
    content: "",
    order: 7,
  },
  interests: {
    type: "interests",
    title: "Interests",
    content: {
      interests: [],
    },
    order: 8,
  },
};

// Keyword mappings to section types
const KEYWORD_MAPPINGS = {
  education: [
    "education",
    "school",
    "university",
    "college",
    "degree",
    "study",
    "studies",
    "academic",
    "student",
    "learn",
    "learning",
  ],
  achievements: [
    "achievement",
    "achievements",
    "award",
    "awards",
    "prize",
    "prizes",
    "recognition",
    "honor",
    "honors",
    "medal",
    "medals",
    "trophy",
    "trophies",
    "win",
    "won",
    "winner",
    "champion",
    "olympiad",
    "competition",
    "contest",
  ],
  projects: [
    "project",
    "projects",
    "work",
    "works",
    "portfolio",
    "portfolio",
    "development",
    "develop",
    "built",
    "create",
    "created",
    "application",
    "app",
    "website",
    "web",
    "software",
    "programming",
    "code",
    "coding",
  ],
  certificates: [
    "certificate",
    "certificates",
    "certification",
    "certifications",
    "diploma",
    "diplomas",
    "license",
    "licenses",
    "credential",
    "credentials",
  ],
  skills: [
    "skill",
    "skills",
    "ability",
    "abilities",
    "expertise",
    "proficient",
    "proficiency",
    "know",
    "knowledge",
    "experience",
    "experienced",
    "technology",
    "technologies",
    "language",
    "languages",
    "framework",
    "frameworks",
    "tool",
    "tools",
  ],
  contact: [
    "contact",
    "email",
    "phone",
    "address",
    "reach",
    "connect",
    "social",
    "linkedin",
    "github",
    "twitter",
  ],
};

// Extract text content for about section
function extractAboutContent(text) {
  // Look for introductory phrases
  const introPatterns = [
    /i\s+(?:am|am\s+a|am\s+an)\s+([^.!?]+)/i,
    /my\s+name\s+is\s+([^.!?]+)/i,
    /i\s+(?:study|studied|work|worked)\s+([^.!?]+)/i,
  ];

  for (const pattern of introPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // Fallback: first sentence
  const firstSentence = text.split(/[.!?]/)[0].trim();
  return firstSentence || text.substring(0, 200);
}

// Extract items for list-based sections
function extractItems(text, keywords) {
  const items = [];
  const sentences = text.split(/[.!?]/).filter((s) => s.trim().length > 0);

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    const hasKeyword = keywords.some((keyword) =>
      lowerSentence.includes(keyword)
    );

    if (hasKeyword) {
      // Try to extract structured data
      const item = {
        title: sentence.trim().substring(0, 100),
        description: sentence.trim(),
        date: extractDate(sentence),
      };
      items.push(item);
    }
  }

  return items;
}

// Extract date from text
function extractDate(text) {
  const datePatterns = [
    /\d{4}/, // Year
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
    /\d{1,2}\/\d{1,2}\/\d{4}/,
    /\d{4}-\d{2}-\d{2}/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

// Extract skills from text
function extractSkills(text) {
  const skills = [];
  const skillKeywords = KEYWORD_MAPPINGS.skills;
  const sentences = text.split(/[.!?,]/).filter((s) => s.trim().length > 0);

  // Common technology/skill names
  const commonSkills = [
    "javascript",
    "python",
    "java",
    "c++",
    "c#",
    "react",
    "node",
    "vue",
    "angular",
    "html",
    "css",
    "sql",
    "mongodb",
    "mysql",
    "postgresql",
    "git",
    "github",
    "mathematics",
    "physics",
    "chemistry",
    "biology",
    "programming",
    "coding",
    "problem solving",
    "teamwork",
    "leadership",
    "communication",
  ];

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();

    // Check for common skills
    for (const skill of commonSkills) {
      if (lowerSentence.includes(skill) && !skills.includes(skill)) {
        skills.push(skill);
      }
    }

    // Check for skill keywords followed by skill names
    for (const keyword of skillKeywords) {
      if (lowerSentence.includes(keyword)) {
        // Extract words after keyword
        const keywordIndex = lowerSentence.indexOf(keyword);
        const afterKeyword = sentence
          .substring(keywordIndex + keyword.length)
          .trim();
        const words = afterKeyword.split(/\s+/).slice(0, 5);
        words.forEach((word) => {
          const cleanWord = word.replace(/[^a-z0-9]/gi, "").toLowerCase();
          if (
            cleanWord.length > 2 &&
            !skills.includes(cleanWord) &&
            !commonSkills.includes(cleanWord)
          ) {
            skills.push(cleanWord);
          }
        });
      }
    }
  }

  return skills.slice(0, 20); // Limit to 20 skills
}

// Generate portfolio structure from text
export function generatePortfolioFromText(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Text input is required");
  }

  const normalizedText = text.trim();
  let sections = [];
  const detectedSections = new Set();

  // Always include About section
  const aboutSection = { ...SECTION_TEMPLATES.about };
  aboutSection.content = extractAboutContent(normalizedText);
  sections.push(aboutSection);
  detectedSections.add("about");

  // Check for education keywords
  if (
    KEYWORD_MAPPINGS.education.some((keyword) =>
      normalizedText.toLowerCase().includes(keyword)
    )
  ) {
    const educationSection = { ...SECTION_TEMPLATES.education };
    educationSection.items = extractItems(
      normalizedText,
      KEYWORD_MAPPINGS.education
    );
    sections.push(educationSection);
    detectedSections.add("education");
  }

  // Check for achievements keywords
  if (
    KEYWORD_MAPPINGS.achievements.some((keyword) =>
      normalizedText.toLowerCase().includes(keyword)
    )
  ) {
    const achievementsSection = { ...SECTION_TEMPLATES.achievements };
    achievementsSection.items = extractItems(
      normalizedText,
      KEYWORD_MAPPINGS.achievements
    );
    sections.push(achievementsSection);
    detectedSections.add("achievements");
  }

  // Check for projects keywords
  if (
    KEYWORD_MAPPINGS.projects.some((keyword) =>
      normalizedText.toLowerCase().includes(keyword)
    )
  ) {
    const projectsSection = { ...SECTION_TEMPLATES.projects };
    projectsSection.items = extractItems(
      normalizedText,
      KEYWORD_MAPPINGS.projects
    );
    sections.push(projectsSection);
    detectedSections.add("projects");
  }

  // Check for certificates keywords
  if (
    KEYWORD_MAPPINGS.certificates.some((keyword) =>
      normalizedText.toLowerCase().includes(keyword)
    )
  ) {
    const certificatesSection = { ...SECTION_TEMPLATES.certificates };
    certificatesSection.items = extractItems(
      normalizedText,
      KEYWORD_MAPPINGS.certificates
    );
    sections.push(certificatesSection);
    detectedSections.add("certificates");
  }

  // Check for skills keywords
  if (
    KEYWORD_MAPPINGS.skills.some((keyword) =>
      normalizedText.toLowerCase().includes(keyword)
    )
  ) {
    const skillsSection = { ...SECTION_TEMPLATES.skills };
    const extractedSkills = extractSkills(normalizedText);
    skillsSection.items = extractedSkills.map((skill) => ({
      name: skill,
      level: "intermediate", // Default level
    }));
    sections.push(skillsSection);
    detectedSections.add("skills");
  }

  // Always include Contact section (empty)
  if (!detectedSections.has("contact")) {
    sections.push({ ...SECTION_TEMPLATES.contact });
  }

  // Sort sections by order
  sections.sort((a, b) => (a.order || 999) - (b.order || 999));

  // Add IDs, slugs, and enabled flags to sections if not present
  const slugMap = new Map();
  sections = sections.map((section, index) => {
    const sectionId = section.id || `${section.type}-${index + 1}`;

    // Generate slug if not provided
    let sectionSlug = section.slug;
    if (
      !sectionSlug ||
      typeof sectionSlug !== "string" ||
      !sectionSlug.trim()
    ) {
      // Generate from id (e.g., "about-1" -> "about")
      sectionSlug = sectionId.split("-")[0].toLowerCase();
    } else {
      // Normalize provided slug
      sectionSlug = sectionSlug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    // Ensure uniqueness
    let uniqueSlug = sectionSlug;
    let counter = 1;
    while (slugMap.has(uniqueSlug)) {
      uniqueSlug = `${sectionSlug}-${counter}`;
      counter++;
    }
    slugMap.set(uniqueSlug, true);

    return {
      id: sectionId,
      slug: uniqueSlug,
      type: section.type,
      enabled: section.enabled !== undefined ? section.enabled : true,
      order: section.order || index + 1,
      title: section.title,
      content:
        section.content || (section.items ? { items: section.items } : {}),
    };
  });

  // Generate default theme
  const theme = {
    name: "modern",
    colors: {
      primary: "#1A1A1A",
      secondary: "#4A4A4A",
      background: "#FAFAFA",
      text: "#1A1A1A",
      accent: "#6366F1",
    },
    typography: {
      fontFamily: "Inter, system-ui, sans-serif",
      headingSize: "3rem",
      bodySize: "1.125rem",
    },
    spacing: "spacious",
  };

  return {
    layout: "single-page",
    visibility: "private",
    theme,
    hero: {
      title: null,
      subtitle: null,
      image: null,
      ctaText: null,
      ctaLink: null,
    },
    sections,
    certificates: [],
    animations: {
      enabled: true,
      type: "fade",
    },
    // Legacy support
    isPublic: false,
  };
}

// Sanitize text input
export function sanitizeText(text) {
  if (typeof text !== "string") {
    return "";
  }

  // Remove potentially dangerous HTML/script tags
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export default {
  generatePortfolioFromText,
  sanitizeText,
};
