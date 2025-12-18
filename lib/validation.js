// Validation utilities for portfolio system

// Valid section types
const VALID_SECTION_TYPES = [
  "about",
  "education",
  "achievements",
  "projects",
  "certificates",
  "skills",
  "contact",
  "interests",
  "custom",
];

/**
 * Sanitize text input to prevent XSS attacks
 */
export function sanitizeText(text) {
  if (typeof text !== "string") {
    return "";
  }

  // Remove potentially dangerous HTML/script tags
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/**
 * Validate portfolio section structure
 */
export function validateSection(section) {
  if (!section || typeof section !== "object") {
    return { valid: false, error: "Section must be an object" };
  }

  // Required fields
  if (!section.type || typeof section.type !== "string") {
    return { valid: false, error: "Section type is required" };
  }

  // Validate section type
  if (!VALID_SECTION_TYPES.includes(section.type)) {
    return {
      valid: false,
      error: `Invalid section type: ${
        section.type
      }. Valid types: ${VALID_SECTION_TYPES.join(", ")}`,
    };
  }

  // Validate section structure
  if (section.id && typeof section.id !== "string") {
    return { valid: false, error: "Section id must be a string" };
  }
  if (section.slug && typeof section.slug !== "string") {
    return { valid: false, error: "Section slug must be a string" };
  }
  if (section.enabled !== undefined && typeof section.enabled !== "boolean") {
    return { valid: false, error: "Section enabled must be a boolean" };
  }
  if (section.order !== undefined && typeof section.order !== "number") {
    return { valid: false, error: "Section order must be a number" };
  }

  // Sanitize text fields
  if (section.title && typeof section.title === "string") {
    section.title = sanitizeText(section.title);
  }

  // Handle content - can be string (legacy) or object (new structure)
  if (section.content !== undefined) {
    if (typeof section.content === "string") {
      // Legacy: content as string - convert to new format
      section.content = { text: sanitizeText(section.content) };
    } else if (
      typeof section.content === "object" &&
      section.content !== null
    ) {
      // Handle nested content.content (for custom sections)
      if (
        section.content.content &&
        typeof section.content.content === "string"
      ) {
        section.content.text = sanitizeText(section.content.content);
        delete section.content.content;
      }
      // Sanitize content object fields
      if (section.content.text && typeof section.content.text === "string") {
        section.content.text = sanitizeText(section.content.text);
      }
      // Sanitize arrays in content (achievements, projects, etc.)
      if (Array.isArray(section.content.achievements)) {
        section.content.achievements = section.content.achievements.map(
          (item) => {
            if (item.title) item.title = sanitizeText(item.title);
            if (item.description)
              item.description = sanitizeText(item.description);
            if (item.awardedBy) item.awardedBy = sanitizeText(item.awardedBy);
            return item;
          }
        );
      }
      if (Array.isArray(section.content.projects)) {
        section.content.projects = section.content.projects.map((item) => {
          if (item.title) item.title = sanitizeText(item.title);
          if (item.description)
            item.description = sanitizeText(item.description);
          return item;
        });
      }
      if (Array.isArray(section.content.education)) {
        section.content.education = section.content.education.map((item) => {
          if (item.title) item.title = sanitizeText(item.title);
          if (item.description)
            item.description = sanitizeText(item.description);
          if (item.institution)
            item.institution = sanitizeText(item.institution);
          return item;
        });
      }
      if (Array.isArray(section.content.certificates)) {
        section.content.certificates = section.content.certificates.map(
          (item) => {
            if (item.title) item.title = sanitizeText(item.title);
            if (item.description)
              item.description = sanitizeText(item.description);
            if (item.issuedBy) item.issuedBy = sanitizeText(item.issuedBy);
            return item;
          }
        );
      }
      if (Array.isArray(section.content.skills)) {
        section.content.skills = section.content.skills.map((item) => {
          if (item.name) item.name = sanitizeText(item.name);
          if (item.category) item.category = sanitizeText(item.category);
          return item;
        });
      }
      if (Array.isArray(section.content.interests)) {
        section.content.interests = section.content.interests.map((interest) =>
          typeof interest === "string" ? sanitizeText(interest) : interest
        );
      }
    }
  }

  if (section.description && typeof section.description === "string") {
    section.description = sanitizeText(section.description);
  }

  // Handle legacy items array - convert to content structure
  if (section.items && Array.isArray(section.items)) {
    // Initialize content object if it doesn't exist or is a string
    if (!section.content || typeof section.content === "string") {
      section.content = {};
    }

    if (section.type === "skills") {
      // Skills: items are strings or objects
      section.content.skills = section.items.map((item) => {
        if (typeof item === "string") {
          return {
            name: sanitizeText(item.trim()),
            level: "intermediate",
            category: "General",
          };
        } else if (typeof item === "object") {
          return {
            name: item.name ? sanitizeText(item.name) : "",
            level: item.level || "intermediate",
            category: item.category ? sanitizeText(item.category) : "General",
          };
        }
        return item;
      });
    } else if (section.type === "interests") {
      // Interests: items are strings
      section.content.interests = section.items.map((item) =>
        typeof item === "string" ? sanitizeText(item.trim()) : item
      );
    } else if (section.type === "achievements") {
      // Achievements: items are objects
      section.content.achievements = section.items.map((item) => {
        if (typeof item === "object") {
          const achievement = {};
          if (item.title) achievement.title = sanitizeText(item.title);
          if (item.description)
            achievement.description = sanitizeText(item.description);
          if (item.date) achievement.date = item.date;
          if (item.awardedBy)
            achievement.awardedBy = sanitizeText(item.awardedBy);
          if (item.certificateUrl)
            achievement.certificateUrl = item.certificateUrl;
          return achievement;
        }
        return item;
      });
    } else if (section.type === "projects") {
      // Projects: items are objects
      section.content.projects = section.items.map((item) => {
        if (typeof item === "object") {
          const project = {};
          if (item.title) project.title = sanitizeText(item.title);
          if (item.description)
            project.description = sanitizeText(item.description);
          if (item.date) project.date = item.date;
          if (item.technologies) project.technologies = item.technologies;
          if (item.githubUrl) project.githubUrl = item.githubUrl;
          if (item.demoUrl) project.demoUrl = item.demoUrl;
          if (item.image) project.image = item.image;
          return project;
        }
        return item;
      });
    } else if (section.type === "education") {
      // Education: items are objects
      section.content.education = section.items.map((item) => {
        if (typeof item === "object") {
          const education = {};
          if (item.title) education.title = sanitizeText(item.title);
          if (item.description)
            education.description = sanitizeText(item.description);
          if (item.date) education.date = item.date;
          if (item.institution)
            education.institution = sanitizeText(item.institution);
          if (item.location) education.location = sanitizeText(item.location);
          if (item.gpa) education.gpa = item.gpa;
          return education;
        }
        return item;
      });
    } else if (section.type === "certificates") {
      // Certificates: items are objects
      section.content.certificates = section.items.map((item) => {
        if (typeof item === "object") {
          const cert = {};
          if (item.title) cert.title = sanitizeText(item.title);
          if (item.description)
            cert.description = sanitizeText(item.description);
          if (item.date) cert.date = item.date;
          if (item.issuedBy) cert.issuedBy = sanitizeText(item.issuedBy);
          if (item.certificateUrl) cert.certificateUrl = item.certificateUrl;
          return cert;
        }
        return item;
      });
    } else {
      // Generic items - keep as is in content.items
      section.content.items = section.items;
    }

    // Remove legacy items array after conversion
    delete section.items;
  }

  return { valid: true, section };
}

/**
 * Generate a URL-safe slug from a string
 */
function generateSlug(text) {
  if (!text || typeof text !== "string") {
    return "";
  }
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Generate section slug from id or type
 */
function generateSectionSlug(section) {
  if (section.slug && typeof section.slug === "string" && section.slug.trim()) {
    return generateSlug(section.slug);
  }

  // Generate from id (e.g., "about-1" -> "about")
  if (section.id && typeof section.id === "string") {
    const slugFromId = section.id.split("-")[0];
    return generateSlug(slugFromId);
  }

  // Fallback to type
  if (section.type && typeof section.type === "string") {
    return generateSlug(section.type);
  }

  return "section";
}

/**
 * Validate portfolio sections array
 */
export function validateSections(sections) {
  if (!Array.isArray(sections)) {
    return { valid: false, error: "Sections must be an array" };
  }

  const validatedSections = [];
  const slugMap = new Map(); // Track slugs for uniqueness
  const reservedSlugs = ["home", "index", "admin", "api", "portfolio"]; // Reserved routes

  for (let i = 0; i < sections.length; i++) {
    const validation = validateSection(sections[i]);
    if (!validation.valid) {
      return { valid: false, error: `Section ${i}: ${validation.error}` };
    }

    const section = validation.section;

    // Generate slug if missing
    if (
      !section.slug ||
      typeof section.slug !== "string" ||
      !section.slug.trim()
    ) {
      section.slug = generateSectionSlug(section);
    } else {
      // Normalize provided slug
      section.slug = generateSlug(section.slug);
    }

    // Validate slug format
    if (!/^[a-z0-9-]{1,50}$/.test(section.slug)) {
      return {
        valid: false,
        error: `Section ${i}: Slug must be 1-50 characters and contain only lowercase letters, numbers, and hyphens`,
      };
    }

    // Check for reserved slugs
    if (reservedSlugs.includes(section.slug)) {
      section.slug = `${section.slug}-section`; // Append "-section" to reserved slugs
    }

    // Ensure uniqueness within portfolio
    let uniqueSlug = section.slug;
    let counter = 1;
    while (slugMap.has(uniqueSlug)) {
      uniqueSlug = `${section.slug}-${counter}`;
      counter++;
    }
    section.slug = uniqueSlug;
    slugMap.set(uniqueSlug, true);

    validatedSections.push(section);
  }

  return { valid: true, sections: validatedSections };
}

/**
 * Validate theme object
 */
export function validateTheme(theme) {
  if (!theme || typeof theme !== "object") {
    return { valid: false, error: "Theme must be an object" };
  }

  // Validate theme name
  if (theme.name && typeof theme.name !== "string") {
    return { valid: false, error: "Theme name must be a string" };
  }
  if (theme.name && theme.name.length > 50) {
    return {
      valid: false,
      error: "Theme name is too long (max 50 characters)",
    };
  }

  // Validate colors
  if (theme.colors && typeof theme.colors === "object") {
    // Ensure color values are strings (hex codes, rgb, etc.)
    for (const key in theme.colors) {
      if (typeof theme.colors[key] !== "string") {
        return {
          valid: false,
          error: `Color value for ${key} must be a string`,
        };
      }
      // Basic validation for color format (hex, rgb, etc.)
      const colorValue = theme.colors[key].trim();
      if (colorValue.length > 50) {
        return { valid: false, error: `Color value for ${key} is too long` };
      }
    }
  }

  // Validate typography
  if (theme.typography && typeof theme.typography === "object") {
    for (const key in theme.typography) {
      if (typeof theme.typography[key] !== "string") {
        return {
          valid: false,
          error: `Typography value for ${key} must be a string`,
        };
      }
      const typoValue = theme.typography[key].trim();
      if (typoValue.length > 200) {
        return {
          valid: false,
          error: `Typography value for ${key} is too long`,
        };
      }
    }
  }

  // Validate spacing
  if (theme.spacing !== undefined) {
    if (!["compact", "comfortable", "spacious"].includes(theme.spacing)) {
      return {
        valid: false,
        error: 'Spacing must be "compact", "comfortable", or "spacious"',
      };
    }
  }

  // Validate fonts (legacy support)
  if (theme.fonts && typeof theme.fonts === "object") {
    for (const key in theme.fonts) {
      if (typeof theme.fonts[key] !== "string") {
        return {
          valid: false,
          error: `Font value for ${key} must be a string`,
        };
      }
      const fontValue = theme.fonts[key].trim();
      if (fontValue.length > 100) {
        return { valid: false, error: `Font value for ${key} is too long` };
      }
    }
  }

  // Validate styles (legacy support)
  if (theme.styles && typeof theme.styles === "object") {
    // Styles can be any object, but limit depth
    const stylesStr = JSON.stringify(theme.styles);
    if (stylesStr.length > 10000) {
      return { valid: false, error: "Styles object is too large" };
    }
  }

  return { valid: true, theme };
}

/**
 * Validate certificate object
 */
export function validateCertificate(certificate) {
  if (!certificate || typeof certificate !== "object") {
    return { valid: false, error: "Certificate must be an object" };
  }

  // Required fields
  if (!certificate.fileUrl || typeof certificate.fileUrl !== "string") {
    return { valid: false, error: "Certificate fileUrl is required" };
  }

  if (!certificate.fileName || typeof certificate.fileName !== "string") {
    return { valid: false, error: "Certificate fileName is required" };
  }

  if (!certificate.fileType || typeof certificate.fileType !== "string") {
    return { valid: false, error: "Certificate fileType is required" };
  }

  // Validate file type
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
  ];
  if (!allowedTypes.includes(certificate.fileType)) {
    return { valid: false, error: "Invalid certificate file type" };
  }

  // Sanitize text fields
  if (certificate.title && typeof certificate.title === "string") {
    certificate.title = sanitizeText(certificate.title);
  }
  if (certificate.issuedBy && typeof certificate.issuedBy === "string") {
    certificate.issuedBy = sanitizeText(certificate.issuedBy);
  }

  return { valid: true, certificate };
}

/**
 * Validate certificates array
 */
export function validateCertificates(certificates) {
  if (!Array.isArray(certificates)) {
    return { valid: false, error: "Certificates must be an array" };
  }

  const validatedCertificates = [];
  for (let i = 0; i < certificates.length; i++) {
    const validation = validateCertificate(certificates[i]);
    if (!validation.valid) {
      return { valid: false, error: `Certificate ${i}: ${validation.error}` };
    }
    validatedCertificates.push(validation.certificate);
  }

  return { valid: true, certificates: validatedCertificates };
}

/**
 * Validate slug format
 */
export function validateSlug(slug) {
  if (!slug || typeof slug !== "string") {
    return { valid: false, error: "Slug must be a non-empty string" };
  }

  const slugRegex = /^[a-z0-9-]{3,50}$/;
  if (!slugRegex.test(slug.toLowerCase())) {
    return {
      valid: false,
      error:
        "Slug must be 3-50 characters and contain only lowercase letters, numbers, and hyphens",
    };
  }

  return { valid: true, slug: slug.toLowerCase().trim() };
}

/**
 * Validate portfolio data structure
 */
export function validatePortfolioData(portfolioData, isUpdate = false) {
  const errors = [];

  // Validate slug (required for create, optional for update)
  if (!isUpdate || portfolioData.slug !== undefined) {
    if (portfolioData.slug !== undefined) {
      const slugValidation = validateSlug(portfolioData.slug);
      if (!slugValidation.valid) {
        errors.push(slugValidation.error);
      }
    } else if (!isUpdate) {
      errors.push("Slug is required");
    }
  }

  // Validate visibility
  if (portfolioData.visibility !== undefined) {
    if (!["public", "private", "unlisted"].includes(portfolioData.visibility)) {
      errors.push('Visibility must be "public", "private", or "unlisted"');
    }
  }

  // Validate layout (supports both legacy string and new object format)
  if (portfolioData.layout !== undefined) {
    if (typeof portfolioData.layout === "string") {
      // Legacy format: string
      if (!["single-page", "multi-page"].includes(portfolioData.layout)) {
        errors.push('Layout must be either "single-page" or "multi-page"');
      }
    } else if (
      typeof portfolioData.layout === "object" &&
      portfolioData.layout !== null
    ) {
      // New format: object with type and blocks
      if (portfolioData.layout.type !== undefined) {
        if (
          !["single-page", "multi-page"].includes(portfolioData.layout.type)
        ) {
          errors.push(
            'Layout.type must be either "single-page" or "multi-page"'
          );
        }
      }
      // Validate blocks if provided
      if (portfolioData.layout.blocks !== undefined) {
        const blocksValidation = validateBlocks(portfolioData.layout.blocks);
        if (!blocksValidation.valid) {
          errors.push(`Layout blocks: ${blocksValidation.error}`);
        } else {
          portfolioData.layout.blocks = blocksValidation.blocks;
        }
      }
    } else {
      errors.push(
        'Layout must be a string ("single-page" or "multi-page") or an object with type and blocks'
      );
    }
  }

  // Validate status (draft/published)
  if (portfolioData.status !== undefined) {
    if (!["draft", "published"].includes(portfolioData.status)) {
      errors.push('Status must be either "draft" or "published"');
    }
  }

  // Validate theme
  if (portfolioData.theme !== undefined) {
    const themeValidation = validateTheme(portfolioData.theme);
    if (!themeValidation.valid) {
      errors.push(themeValidation.error);
    }
  }

  // Validate hero section (optional, like theme)
  if (portfolioData.hero !== undefined) {
    if (portfolioData.hero === null) {
      // Allow null to remove hero
      portfolioData.hero = null;
    } else if (typeof portfolioData.hero !== "object") {
      errors.push("Hero must be an object or null");
    } else {
      // Sanitize and validate hero fields
      const hero = {
        title: portfolioData.hero.title
          ? sanitizeText(String(portfolioData.hero.title))
          : null,
        subtitle: portfolioData.hero.subtitle
          ? sanitizeText(String(portfolioData.hero.subtitle))
          : null,
        image: portfolioData.hero.image
          ? String(portfolioData.hero.image).trim()
          : null,
        ctaText: portfolioData.hero.ctaText
          ? sanitizeText(String(portfolioData.hero.ctaText))
          : null,
        ctaLink: null,
      };

      // Validate CTA Link if provided
      if (
        portfolioData.hero.ctaLink !== undefined &&
        portfolioData.hero.ctaLink !== null &&
        portfolioData.hero.ctaLink !== ""
      ) {
        const ctaLink = String(portfolioData.hero.ctaLink).trim();
        if (
          !ctaLink.startsWith("#") &&
          !ctaLink.startsWith("http://") &&
          !ctaLink.startsWith("https://") &&
          !ctaLink.startsWith("/")
        ) {
          errors.push(
            "CTA Link must be a valid URL, path, or anchor (starting with #, /, http://, or https://)"
          );
        } else {
          hero.ctaLink = ctaLink;
        }
      }

      portfolioData.hero = hero;
    }
  }

  // Validate sections
  if (portfolioData.sections !== undefined) {
    const sectionsValidation = validateSections(portfolioData.sections);
    if (!sectionsValidation.valid) {
      errors.push(sectionsValidation.error);
    } else {
      portfolioData.sections = sectionsValidation.sections;
    }
  }

  // Validate certificates
  if (portfolioData.certificates !== undefined) {
    const certificatesValidation = validateCertificates(
      portfolioData.certificates
    );
    if (!certificatesValidation.valid) {
      errors.push(certificatesValidation.error);
    } else {
      portfolioData.certificates = certificatesValidation.certificates;
    }
  }

  // Validate animations
  if (
    portfolioData.animations !== undefined &&
    portfolioData.animations !== null
  ) {
    if (typeof portfolioData.animations !== "object") {
      errors.push("Animations must be an object");
    } else {
      if (
        portfolioData.animations.enabled !== undefined &&
        typeof portfolioData.animations.enabled !== "boolean"
      ) {
        errors.push("Animations.enabled must be a boolean");
      }
      if (
        portfolioData.animations.type !== undefined &&
        !["fade", "slide", "none"].includes(portfolioData.animations.type)
      ) {
        errors.push('Animations.type must be "fade", "slide", or "none"');
      }
    }
  }

  // Validate isPublic (legacy - convert to visibility if needed)
  if (
    portfolioData.isPublic !== undefined &&
    typeof portfolioData.isPublic !== "boolean"
  ) {
    errors.push("isPublic must be a boolean");
  } else if (
    portfolioData.isPublic !== undefined &&
    portfolioData.visibility === undefined
  ) {
    // Convert legacy isPublic to visibility
    portfolioData.visibility = portfolioData.isPublic ? "public" : "private";
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, portfolioData };
}

/**
 * Valid block types
 */
const VALID_BLOCK_TYPES = [
  "text",
  "projects",
  "skills",
  "certificates",
  "custom",
];

/**
 * Validate a single block
 */
export function validateBlock(block) {
  if (!block || typeof block !== "object") {
    return { valid: false, error: "Block must be an object" };
  }

  // Required fields
  if (!block.id || typeof block.id !== "string") {
    return { valid: false, error: "Block id is required and must be a string" };
  }

  if (!block.type || typeof block.type !== "string") {
    return { valid: false, error: "Block type is required" };
  }

  // Validate block type
  if (!VALID_BLOCK_TYPES.includes(block.type)) {
    return {
      valid: false,
      error: `Invalid block type: ${
        block.type
      }. Valid types: ${VALID_BLOCK_TYPES.join(", ")}`,
    };
  }

  // Validate order
  if (block.order !== undefined && typeof block.order !== "number") {
    return { valid: false, error: "Block order must be a number" };
  }

  if (block.order !== undefined && block.order < 0) {
    return { valid: false, error: "Block order must be non-negative" };
  }

  // Validate visibility
  if (
    block.visibility !== undefined &&
    !["public", "private"].includes(block.visibility)
  ) {
    return {
      valid: false,
      error: 'Block visibility must be "public" or "private"',
    };
  }

  // Validate styleConfig if provided
  if (block.styleConfig !== undefined) {
    if (typeof block.styleConfig !== "object" || block.styleConfig === null) {
      return {
        valid: false,
        error: "Block styleConfig must be an object",
      };
    }

    // Validate styleConfig properties
    if (
      block.styleConfig.colors !== undefined &&
      typeof block.styleConfig.colors !== "object"
    ) {
      return {
        valid: false,
        error: "Block styleConfig.colors must be an object",
      };
    }

    if (
      block.styleConfig.spacing !== undefined &&
      typeof block.styleConfig.spacing !== "object"
    ) {
      return {
        valid: false,
        error: "Block styleConfig.spacing must be an object",
      };
    }

    if (
      block.styleConfig.typography !== undefined &&
      typeof block.styleConfig.typography !== "object"
    ) {
      return {
        valid: false,
        error: "Block styleConfig.typography must be an object",
      };
    }
  }

  // Sanitize content if it's a string
  if (block.content !== undefined) {
    if (typeof block.content === "string") {
      block.content = { text: sanitizeText(block.content) };
    } else if (typeof block.content === "object" && block.content !== null) {
      // Sanitize text fields in content object
      if (block.content.text && typeof block.content.text === "string") {
        block.content.text = sanitizeText(block.content.text);
      }
      if (block.content.title && typeof block.content.title === "string") {
        block.content.title = sanitizeText(block.content.title);
      }
      if (
        block.content.description &&
        typeof block.content.description === "string"
      ) {
        block.content.description = sanitizeText(block.content.description);
      }
    }
  }

  // Validate verification field if provided
  if (block.verification !== undefined) {
    const verificationValidation = validateVerification(block.verification);
    if (!verificationValidation.valid) {
      return {
        valid: false,
        error: `Verification: ${verificationValidation.error}`,
      };
    }
    block.verification = verificationValidation.verification;
  }

  return { valid: true, block };
}

/**
 * Validate verification object
 */
export function validateVerification(verification) {
  if (!verification || typeof verification !== "object") {
    return { valid: false, error: "Verification must be an object" };
  }

  // Validate status
  if (verification.status !== undefined) {
    const validStatuses = ["unverified", "pending", "verified", "rejected"];
    if (!validStatuses.includes(verification.status)) {
      return {
        valid: false,
        error: `Invalid verification status: ${
          verification.status
        }. Valid statuses: ${validStatuses.join(", ")}`,
      };
    }
  }

  // Validate verifiedBy
  if (
    verification.verifiedBy !== undefined &&
    verification.verifiedBy !== null
  ) {
    const validVerifiedBy = ["system", "admin", "external"];
    if (!validVerifiedBy.includes(verification.verifiedBy)) {
      return {
        valid: false,
        error: `Invalid verifiedBy: ${
          verification.verifiedBy
        }. Valid values: ${validVerifiedBy.join(", ")}`,
      };
    }
  }

  // Validate dates
  if (
    verification.verifiedAt !== undefined &&
    verification.verifiedAt !== null
  ) {
    if (
      !(verification.verifiedAt instanceof Date) &&
      typeof verification.verifiedAt !== "string"
    ) {
      return { valid: false, error: "verifiedAt must be a Date or string" };
    }
  }

  if (
    verification.requestedAt !== undefined &&
    verification.requestedAt !== null
  ) {
    if (
      !(verification.requestedAt instanceof Date) &&
      typeof verification.requestedAt !== "string"
    ) {
      return { valid: false, error: "requestedAt must be a Date or string" };
    }
  }

  // Sanitize text fields
  if (verification.note && typeof verification.note === "string") {
    verification.note = sanitizeText(verification.note);
  }

  if (
    verification.rejectionReason &&
    typeof verification.rejectionReason === "string"
  ) {
    verification.rejectionReason = sanitizeText(verification.rejectionReason);
  }

  return { valid: true, verification };
}

/**
 * Validate blocks array
 */
export function validateBlocks(blocks) {
  if (!Array.isArray(blocks)) {
    return { valid: false, error: "Blocks must be an array" };
  }

  const validatedBlocks = [];
  const blockIdMap = new Map(); // Track block IDs for uniqueness

  for (let i = 0; i < blocks.length; i++) {
    const validation = validateBlock(blocks[i]);
    if (!validation.valid) {
      return { valid: false, error: `Block ${i}: ${validation.error}` };
    }

    const block = validation.block;

    // Check for duplicate block IDs
    if (blockIdMap.has(block.id)) {
      return {
        valid: false,
        error: `Block ${i}: Duplicate block id "${block.id}"`,
      };
    }
    blockIdMap.set(block.id, true);

    // Ensure order is set (default to index if not provided)
    if (block.order === undefined) {
      block.order = i;
    }

    // Ensure visibility is set (default to public)
    if (block.visibility === undefined) {
      block.visibility = "public";
    }

    // Ensure styleConfig structure
    if (!block.styleConfig) {
      block.styleConfig = {
        colors: {},
        spacing: {},
        typography: {},
      };
    }

    validatedBlocks.push(block);
  }

  return { valid: true, blocks: validatedBlocks };
}

export default {
  sanitizeText,
  validateSection,
  validateSections,
  validateTheme,
  validateCertificate,
  validateCertificates,
  validateSlug,
  validatePortfolioData,
  validateBlock,
  validateBlocks,
  validateVerification,
};
