/**
 * Generate a unique block ID
 * @returns {String} - Unique block ID
 */
function generateBlockId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `block-${timestamp}-${random}`;
}

/**
 * Map section type to block type
 * @param {String} sectionType - Section type
 * @returns {String} - Block type
 */
function mapSectionTypeToBlockType(sectionType) {
  const typeMap = {
    about: "text",
    education: "text",
    achievements: "text",
    projects: "projects",
    certificates: "certificates",
    skills: "skills",
    contact: "text",
    interests: "text",
    custom: "custom",
  };

  return typeMap[sectionType] || "custom";
}

/**
 * Convert a section to a block
 * @param {Object} section - Section object
 * @param {Number} order - Block order
 * @returns {Object} - Block object
 */
function convertSectionToBlock(section, order) {
  // Handle content - can be string (legacy) or object
  let content = {};
  if (section.content) {
    if (typeof section.content === "string") {
      // Legacy: content as string - convert to object
      content = { text: section.content };
    } else if (typeof section.content === "object" && section.content !== null) {
      // Content is already an object
      content = { ...section.content };
    }
  }

  const block = {
    id: section.id || generateBlockId(),
    type: mapSectionTypeToBlockType(section.type),
    content: content,
    styleConfig: {
      colors: section.styleConfig?.colors || {},
      spacing: section.styleConfig?.spacing || {},
      typography: section.styleConfig?.typography || {},
    },
    visibility: section.visibility || "public",
    order: section.order !== undefined ? section.order : order,
  };

  // Preserve any additional fields from the section
  if (section.title) {
    block.content.title = section.title;
  }
  if (section.description) {
    block.content.description = section.description;
  }
  if (section.slug) {
    block.content.slug = section.slug;
  }
  if (section.enabled !== undefined) {
    block.content.enabled = section.enabled;
  }

  return block;
}

/**
 * Migrate sections array to blocks array
 * @param {Object} portfolio - Portfolio document
 * @returns {Object} - Portfolio with blocks structure
 */
export function migrateSectionsToBlocks(portfolio) {
  if (!portfolio) {
    return null;
  }

  // Check if already migrated (has layout.blocks)
  if (
    portfolio.layout &&
    typeof portfolio.layout === "object" &&
    portfolio.layout.blocks &&
    Array.isArray(portfolio.layout.blocks) &&
    portfolio.layout.blocks.length > 0
  ) {
    // Already migrated
    return portfolio;
  }

  // Check if portfolio has sections to migrate
  if (
    !portfolio.sections ||
    !Array.isArray(portfolio.sections) ||
    portfolio.sections.length === 0
  ) {
    // No sections to migrate, initialize empty blocks
    if (!portfolio.layout || typeof portfolio.layout !== "object") {
      portfolio.layout = {
        type: typeof portfolio.layout === "string" ? portfolio.layout : "single-page",
        blocks: [],
      };
    } else if (!portfolio.layout.blocks) {
      portfolio.layout.blocks = [];
    }
    return portfolio;
  }

  // Get layout type (preserve existing or default)
  const layoutType =
    typeof portfolio.layout === "string"
      ? portfolio.layout
      : portfolio.layout?.type || "single-page";

  // Convert sections to blocks
  const blocks = portfolio.sections.map((section, index) => {
    const block = convertSectionToBlock(section, index);
    // Ensure verification structure exists
    ensureVerificationStructure(block);
    return block;
  });

  // Sort blocks by order if available
  blocks.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return 0;
  });

  // Ensure all blocks have unique IDs
  const usedIds = new Set();
  blocks.forEach((block) => {
    if (usedIds.has(block.id)) {
      block.id = generateBlockId();
    }
    usedIds.add(block.id);
  });

  // Update portfolio layout
  portfolio.layout = {
    type: layoutType,
    blocks: blocks,
  };

  return portfolio;
}

/**
 * Ensure portfolio has blocks structure (lazy migration)
 * @param {Object} portfolio - Portfolio document
 * @returns {Object} - Portfolio with blocks structure
 */
export function ensureBlocksStructure(portfolio) {
  if (!portfolio) {
    return null;
  }

  // Check if needs migration
  const requiresMigration =
    !portfolio.layout ||
    typeof portfolio.layout === "string" ||
    !portfolio.layout.blocks ||
    !Array.isArray(portfolio.layout.blocks) ||
    portfolio.layout.blocks.length === 0;

  if (requiresMigration) {
    return migrateSectionsToBlocks(portfolio);
  }

  return portfolio;
}

/**
 * Check if portfolio needs migration
 * @param {Object} portfolio - Portfolio document
 * @returns {Boolean} - True if needs migration
 */
export function needsMigration(portfolio) {
  if (!portfolio) {
    return false;
  }

  // Needs migration if:
  // 1. layout is a string (legacy format)
  // 2. layout.blocks doesn't exist or is empty
  // 3. sections exist but blocks don't
  const hasLegacyLayout = typeof portfolio.layout === "string";
  const hasNoBlocks =
    !portfolio.layout ||
    typeof portfolio.layout !== "object" ||
    !portfolio.layout.blocks ||
    !Array.isArray(portfolio.layout.blocks) ||
    portfolio.layout.blocks.length === 0;
  const hasSections =
    portfolio.sections &&
    Array.isArray(portfolio.sections) &&
    portfolio.sections.length > 0;

  return hasLegacyLayout || (hasNoBlocks && hasSections);
}

/**
 * Ensure block has verification structure (defaults for existing blocks)
 * @param {Object} block - Block object
 * @returns {Object} - Block with verification structure
 */
export function ensureVerificationStructure(block) {
  if (!block) {
    return null;
  }

  // If verification already exists, return as is
  if (block.verification && typeof block.verification === "object") {
    return block;
  }

  // Add default verification structure
  block.verification = {
    status: "unverified",
    verifiedBy: null,
    verifiedAt: null,
    verifiedById: null,
    note: null,
    requestedAt: null,
    rejectionReason: null,
  };

  return block;
}

export default {
  migrateSectionsToBlocks,
  ensureBlocksStructure,
  needsMigration,
  convertSectionToBlock,
  generateBlockId,
  ensureVerificationStructure,
};

