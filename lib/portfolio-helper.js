import connectDB from "./mongodb.js";
import Portfolio from "../models/Portfolio.js";
import { findUserByIdWithoutPassword } from "./user-helper.js";
import { ensureBlocksStructure, generateBlockId, needsMigration, ensureVerificationStructure } from "./portfolio-migration.js";
import { checkPortfolioEditable } from "./portfolio-ownership.js";

// Helper function to ensure sections have slugs
function ensureSectionSlugs(portfolio) {
  if (!portfolio || !portfolio.sections || !Array.isArray(portfolio.sections)) {
    return;
  }

  const slugMap = new Map();
  portfolio.sections.forEach((section) => {
    if (
      !section.slug ||
      typeof section.slug !== "string" ||
      !section.slug.trim()
    ) {
      // Generate slug from id or type
      let generatedSlug;
      if (section.id && typeof section.id === "string") {
        generatedSlug = section.id.split("-")[0].toLowerCase();
      } else if (section.type && typeof section.type === "string") {
        generatedSlug = section.type.toLowerCase();
      } else {
        generatedSlug = "section";
      }

      // Ensure uniqueness
      let uniqueSlug = generatedSlug;
      let counter = 1;
      while (slugMap.has(uniqueSlug)) {
        uniqueSlug = `${generatedSlug}-${counter}`;
        counter++;
      }
      section.slug = uniqueSlug;
      slugMap.set(uniqueSlug, true);
    } else {
      slugMap.set(section.slug, true);
    }
  });
}

// Create a new portfolio
export async function createPortfolio(portfolioData) {
  await connectDB();

  // Convert legacy isPublic to visibility if needed
  let visibility = portfolioData.visibility;
  if (!visibility && portfolioData.isPublic !== undefined) {
    visibility = portfolioData.isPublic ? "public" : "private";
  }
  if (!visibility) {
    visibility = "private";
  }

  const portfolio = await Portfolio.create({
    studentId: portfolioData.studentId,
    slug: portfolioData.slug,
    visibility: visibility,
    layout: portfolioData.layout || "single-page",
    status: portfolioData.status || "draft", // Default to draft
    theme: portfolioData.theme || {
      colors: {},
      typography: {},
      spacing: "comfortable",
      fonts: {},
      styles: {},
    },
    hero: portfolioData.hero || {
      title: null,
      subtitle: null,
      image: null,
      ctaText: null,
      ctaLink: null,
    },
    sections: portfolioData.sections || [],
    certificates: portfolioData.certificates || [],
    animations: portfolioData.animations || {
      enabled: false,
      type: "fade",
    },
    // Legacy field - sync with visibility
    isPublic: visibility === "public",
  });

  return portfolio;
}

// Find portfolio by ID
export async function findPortfolioById(id) {
  await connectDB();

  // Validate that id looks like a MongoDB ObjectId (24 hex characters)
  if (
    !id ||
    typeof id !== "string" ||
    id.length !== 24 ||
    !/^[a-f0-9]{24}$/i.test(id)
  ) {
    return null;
  }

  const portfolio = await Portfolio.findById(id);
  if (portfolio) {
    // Ensure hero field exists with default structure if missing
    if (!portfolio.hero || portfolio.hero === null) {
      portfolio.hero = {
        title: null,
        subtitle: null,
        image: null,
        ctaText: null,
        ctaLink: null,
      };
    }
    // Ensure sections have slugs
    ensureSectionSlugs(portfolio);
    // Ensure blocks structure exists (lazy migration on read - optional)
    // Only migrate if needed, don't save automatically
    try {
      if (needsMigration(portfolio)) {
        ensureBlocksStructure(portfolio);
      }
      // Ensure all blocks have verification structure
      if (
        portfolio.layout &&
        typeof portfolio.layout === "object" &&
        portfolio.layout.blocks &&
        Array.isArray(portfolio.layout.blocks)
      ) {
        portfolio.layout.blocks = portfolio.layout.blocks.map((block) =>
          ensureVerificationStructure(block)
        );
      }
    } catch (migrationError) {
      console.error("Error during portfolio migration:", migrationError);
      // Continue without migration - portfolio will work with old format
    }
    if (portfolio.studentId) {
      const user = findUserByIdWithoutPassword(portfolio.studentId);
      if (user) {
        portfolio.studentId = user;
      }
    }
  }
  return portfolio;
}

// Find portfolio by slug
export async function findPortfolioBySlug(slug) {
  await connectDB();
  const portfolio = await Portfolio.findOne({ slug });
  if (portfolio) {
    // Ensure hero field exists with default structure if missing
    if (!portfolio.hero || portfolio.hero === null) {
      portfolio.hero = {
        title: null,
        subtitle: null,
        image: null,
        ctaText: null,
        ctaLink: null,
      };
    }
    // Ensure sections have slugs
    ensureSectionSlugs(portfolio);
    // Ensure blocks structure exists (lazy migration on read - optional)
    try {
      if (needsMigration(portfolio)) {
        ensureBlocksStructure(portfolio);
      }
      // Ensure all blocks have verification structure
      if (
        portfolio.layout &&
        typeof portfolio.layout === "object" &&
        portfolio.layout.blocks &&
        Array.isArray(portfolio.layout.blocks)
      ) {
        portfolio.layout.blocks = portfolio.layout.blocks.map((block) =>
          ensureVerificationStructure(block)
        );
      }
    } catch (migrationError) {
      console.error("Error during portfolio migration:", migrationError);
      // Continue without migration - portfolio will work with old format
    }
    if (portfolio.studentId) {
      const user = findUserByIdWithoutPassword(portfolio.studentId);
      if (user) {
        portfolio.studentId = user;
      }
    }
  }
  return portfolio;
}

// Find portfolios by student ID
export async function findPortfoliosByStudentId(studentId) {
  await connectDB();
  const portfolios = await Portfolio.find({ studentId });
  // Populate studentId with user data from JSON database
  const user = findUserByIdWithoutPassword(studentId);
  if (user) {
    portfolios.forEach((portfolio) => {
      portfolio.studentId = user;
      // Ensure sections have slugs
      ensureSectionSlugs(portfolio);
    });
  } else {
    portfolios.forEach((portfolio) => {
      ensureSectionSlugs(portfolio);
    });
  }
  return portfolios;
}

// Find public portfolios
export async function findPublicPortfolios(limit = 50, skip = 0) {
  await connectDB();
  // Support both new visibility field and legacy isPublic
  const portfolios = await Portfolio.find({
    $or: [{ visibility: "public" }, { isPublic: true }],
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .skip(skip);
  // Populate studentId with user data from JSON database
  portfolios.forEach((portfolio) => {
    if (portfolio.studentId) {
      const user = findUserByIdWithoutPassword(portfolio.studentId);
      if (user) {
        portfolio.studentId = user;
      }
    }
    // Ensure sections have slugs
    ensureSectionSlugs(portfolio);
  });
  return portfolios;
}

// Update portfolio
export async function updatePortfolio(id, updates) {
  await connectDB();

  const portfolio = await Portfolio.findById(id);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  // Ensure blocks structure exists before update (lazy migration on first edit)
  if (needsMigration(portfolio)) {
    ensureBlocksStructure(portfolio);
    // Save the migrated structure
    await portfolio.save();
  }

  // Update allowed fields
  if (updates.slug !== undefined) portfolio.slug = updates.slug;
  if (updates.visibility !== undefined) {
    portfolio.visibility = updates.visibility;
    // Sync legacy isPublic field
    portfolio.isPublic = updates.visibility === "public";
  }
  if (updates.layout !== undefined) portfolio.layout = updates.layout;
  if (updates.theme !== undefined) portfolio.theme = updates.theme;
  if (updates.hero !== undefined) {
    // Handle hero update - like theme, always preserve structure
    if (updates.hero === null) {
      // Set to default empty structure instead of null
      portfolio.hero = {
        title: null,
        subtitle: null,
        image: null,
        ctaText: null,
        ctaLink: null,
      };
    } else if (typeof updates.hero === "object") {
      // Merge with existing hero or use defaults
      portfolio.hero = {
        title:
          updates.hero.title !== undefined
            ? updates.hero.title
            : portfolio.hero?.title || null,
        subtitle:
          updates.hero.subtitle !== undefined
            ? updates.hero.subtitle
            : portfolio.hero?.subtitle || null,
        image:
          updates.hero.image !== undefined
            ? updates.hero.image
            : portfolio.hero?.image || null,
        ctaText:
          updates.hero.ctaText !== undefined
            ? updates.hero.ctaText
            : portfolio.hero?.ctaText || null,
        ctaLink:
          updates.hero.ctaLink !== undefined
            ? updates.hero.ctaLink
            : portfolio.hero?.ctaLink || null,
      };
    }
  }
  if (updates.sections !== undefined) portfolio.sections = updates.sections;
  if (updates.certificates !== undefined)
    portfolio.certificates = updates.certificates;
  if (updates.animations !== undefined)
    portfolio.animations = updates.animations;
  // Status field (draft/published)
  if (updates.status !== undefined) {
    if (["draft", "published"].includes(updates.status)) {
      portfolio.status = updates.status;
    }
  }
  // Legacy isPublic - convert to visibility
  if (updates.isPublic !== undefined) {
    portfolio.isPublic = updates.isPublic;
    portfolio.visibility = updates.isPublic ? "public" : "private";
  }
  // Verification status, ILS level, rating fields
  if (updates.verificationStatus !== undefined) {
    portfolio.verificationStatus = updates.verificationStatus;
  }
  if (updates.verifiedBy !== undefined) {
    portfolio.verifiedBy = updates.verifiedBy;
  }
  if (updates.verifiedAt !== undefined) {
    portfolio.verifiedAt = updates.verifiedAt;
  }
  if (updates.rejectionReason !== undefined) {
    portfolio.rejectionReason = updates.rejectionReason;
  }
  if (updates.ilsLevel !== undefined) {
    portfolio.ilsLevel = updates.ilsLevel;
  }
  if (updates.portfolioRating !== undefined) {
    portfolio.portfolioRating = updates.portfolioRating;
  }

  await portfolio.save();

  // Trigger rating recalculation if verification status or ILS level changed
  const shouldRecalculate =
    updates.verificationStatus !== undefined ||
    updates.ilsLevel !== undefined;
  
  if (shouldRecalculate) {
    try {
      const { recalculatePortfolioRating } = await import("./portfolio-rating.js");
      await recalculatePortfolioRating(id);
    } catch (error) {
      console.error("Error recalculating rating after portfolio update:", error);
      // Continue even if recalculation fails
    }
  }

  return portfolio;
}

// Delete portfolio
export async function deletePortfolio(id) {
  await connectDB();

  const portfolio = await Portfolio.findById(id);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  await Portfolio.findByIdAndDelete(id);
  return true;
}

// Check if slug exists
export async function slugExists(slug, excludeId = null) {
  await connectDB();
  const query = { slug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const portfolio = await Portfolio.findOne(query);
  return !!portfolio;
}

// Add certificate to portfolio
export async function addCertificateToPortfolio(portfolioId, certificateData) {
  await connectDB();

  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  portfolio.certificates.push(certificateData);
  await portfolio.save();
  return portfolio;
}

// Remove certificate from portfolio
export async function removeCertificateFromPortfolio(
  portfolioId,
  certificateId
) {
  await connectDB();

  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  portfolio.certificates = portfolio.certificates.filter(
    (cert) => cert._id.toString() !== certificateId
  );
  await portfolio.save();
  return portfolio;
}

// Filter personal data from portfolio for public/university views
export function filterPersonalData(portfolio, viewerRole = "public", isOwner = false) {
  if (!portfolio) return null;

  const portfolioObj = portfolio.toObject ? portfolio.toObject() : portfolio;

  // If viewer is owner or admin, return full data
  // This function should be called after access control, so we assume filtering is needed

  // Remove sensitive student data
  if (portfolioObj.studentId && typeof portfolioObj.studentId === "object") {
    portfolioObj.studentId = {
      _id: portfolioObj.studentId._id,
      name: portfolioObj.studentId.name,
      // Don't include email, phone, address, dateBorn, gender, etc.
    };
  }

  // Filter blocks by visibility
  if (
    portfolioObj.layout &&
    typeof portfolioObj.layout === "object" &&
    portfolioObj.layout.blocks &&
    Array.isArray(portfolioObj.layout.blocks)
  ) {
    portfolioObj.layout.blocks = filterBlocksByVisibility(
      portfolioObj.layout.blocks,
      viewerRole,
      isOwner
    );
  }

  // Filter sections that might contain personal data
  if (Array.isArray(portfolioObj.sections)) {
    portfolioObj.sections = portfolioObj.sections.map((section) => {
      const filteredSection = { ...section };

      // Filter contact section
      if (filteredSection.type === "contact") {
        // Remove personal contact information
        delete filteredSection.phone;
        delete filteredSection.mobile;
        delete filteredSection.address;
        delete filteredSection.personalEmail;
        delete filteredSection.homeAddress;
        delete filteredSection.postalCode;
        // Keep only public contact methods like social media
      }

      // Filter about section for personal identifiers
      if (filteredSection.type === "about" && filteredSection.content) {
        // Remove email addresses, phone numbers, addresses from content
        let content = filteredSection.content;
        // Remove email patterns
        content = content.replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          ""
        );
        // Remove phone patterns (various formats)
        content = content.replace(
          /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
          ""
        );
        filteredSection.content = content;
      }

      // Filter education section for personal identifiers
      if (
        filteredSection.type === "education" &&
        Array.isArray(filteredSection.items)
      ) {
        filteredSection.items = filteredSection.items.map((item) => {
          const filteredItem = { ...item };
          // Remove personal identifiers from education items
          delete filteredItem.studentId;
          delete filteredItem.personalInfo;
          return filteredItem;
        });
      }

      // Filter items in other sections for personal data
      if (Array.isArray(filteredSection.items)) {
        filteredSection.items = filteredSection.items.map((item) => {
          if (typeof item === "object") {
            const filteredItem = { ...item };
            // Remove common personal data fields
            delete filteredItem.email;
            delete filteredItem.phone;
            delete filteredItem.address;
            delete filteredItem.personalEmail;
            delete filteredItem.contactInfo;
            // Clean description/content fields
            if (filteredItem.description) {
              let desc = filteredItem.description;
              desc = desc.replace(
                /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                ""
              );
              desc = desc.replace(
                /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
                ""
              );
              filteredItem.description = desc;
            }
            return filteredItem;
          }
          return item;
        });
      }

      return filteredSection;
    });
  }

  return portfolioObj;
}

/**
 * Get blocks from portfolio (with lazy migration)
 */
function getBlocksFromPortfolio(portfolio) {
  if (!portfolio) {
    return [];
  }

  // Ensure blocks structure exists
  const portfolioWithBlocks = ensureBlocksStructure(portfolio);

  if (
    portfolioWithBlocks.layout &&
    typeof portfolioWithBlocks.layout === "object" &&
    portfolioWithBlocks.layout.blocks &&
    Array.isArray(portfolioWithBlocks.layout.blocks)
  ) {
    // Ensure all blocks have verification structure
    return portfolioWithBlocks.layout.blocks.map((block) =>
      ensureVerificationStructure(block)
    );
  }

  return [];
}

/**
 * Update a single block in a portfolio (partial update using $set)
 */
export async function updatePortfolioBlock(portfolioId, blockId, updates, user) {
  await connectDB();

  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  // Check if portfolio can be edited
  if (user) {
    const editableError = checkPortfolioEditable(portfolio, user);
    if (editableError) {
      throw new Error(editableError.error);
    }
  }

  // Ensure blocks structure exists
  ensureBlocksStructure(portfolio);

  // Get blocks
  const blocks = getBlocksFromPortfolio(portfolio);
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    throw new Error("Block not found");
  }

  // Update block (partial update)
  const block = blocks[blockIndex];
  // Ensure verification structure exists
  ensureVerificationStructure(block);
  
  const updatedBlock = {
    ...block,
    ...updates,
    id: block.id, // Preserve ID
    order: updates.order !== undefined ? updates.order : block.order, // Preserve or update order
  };
  
  // Ensure verification structure on updated block
  ensureVerificationStructure(updatedBlock);
  
  // Merge verification if provided in updates
  if (updates.verification) {
    updatedBlock.verification = {
      ...block.verification,
      ...updates.verification,
    };
  }

  // Update the block in the array
  blocks[blockIndex] = updatedBlock;

  // Update portfolio using $set for partial update
  const layoutType =
    typeof portfolio.layout === "string"
      ? portfolio.layout
      : portfolio.layout?.type || "single-page";

  await Portfolio.findByIdAndUpdate(portfolioId, {
    $set: {
      "layout.type": layoutType,
      "layout.blocks": blocks,
      updatedAt: new Date(),
    },
  });

  // Return updated portfolio
  const updatedPortfolio = await Portfolio.findById(portfolioId);
  
  // Trigger rating recalculation if achievement/certificate block was updated
  const isAchievementBlock = updatedBlock.type === "achievements" || updatedBlock.type === "certificates";
  const wasAchievementBlock = block.type === "achievements" || block.type === "certificates";
  if (isAchievementBlock || wasAchievementBlock) {
    try {
      const { recalculatePortfolioRating } = await import("./portfolio-rating.js");
      await recalculatePortfolioRating(portfolioId);
    } catch (error) {
      console.error("Error recalculating rating after block update:", error);
      // Continue even if recalculation fails
    }
  }
  
  return updatedPortfolio;
}

/**
 * Add a new block to a portfolio
 */
export async function addBlockToPortfolio(portfolioId, blockData, user) {
  await connectDB();

  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  // Check if portfolio can be edited
  if (user) {
    const editableError = checkPortfolioEditable(portfolio, user);
    if (editableError) {
      throw new Error(editableError.error);
    }
  }

  // Ensure blocks structure exists
  ensureBlocksStructure(portfolio);

  // Get blocks
  const blocks = getBlocksFromPortfolio(portfolio);

  // Generate block ID if not provided
  const blockId = blockData.id || generateBlockId();

  // Check if block ID already exists
  if (blocks.some((b) => b.id === blockId)) {
    throw new Error("Block ID already exists");
  }

  // Determine order (use provided order or append to end)
  let order = blockData.order;
  if (order === undefined) {
    if (blocks.length > 0) {
      order = Math.max(...blocks.map((b) => b.order || 0)) + 1;
    } else {
      order = 0;
    }
  }

  // Create new block
  const newBlock = {
    id: blockId,
    type: blockData.type || "text",
    content: blockData.content || {},
    styleConfig: blockData.styleConfig || {
      colors: {},
      spacing: {},
      typography: {},
    },
    visibility: blockData.visibility || "public",
    order: order,
  };
  
  // Ensure verification structure exists
  ensureVerificationStructure(newBlock);
  
  // Attempt auto-verification if block qualifies
  try {
    const { shouldAutoVerify, autoVerifyBlock } = await import("./verification-auto.js");
    if (shouldAutoVerify(newBlock, portfolio)) {
      const autoVerifyResult = await autoVerifyBlock(newBlock, portfolio);
      if (autoVerifyResult.verified) {
        newBlock.verification = autoVerifyResult.block.verification;
      }
    }
  } catch (error) {
    console.error("Error during auto-verification:", error);
    // Continue without auto-verification
  }

  // Insert block at specified position or append
  if (blockData.position !== undefined && blockData.position >= 0) {
    // Insert at specific position
    blocks.splice(blockData.position, 0, newBlock);
    // Reorder all blocks
    blocks.forEach((block, index) => {
      block.order = index;
    });
  } else {
    // Append to end
    blocks.push(newBlock);
  }

  // Update portfolio
  const layoutType =
    typeof portfolio.layout === "string"
      ? portfolio.layout
      : portfolio.layout?.type || "single-page";

  await Portfolio.findByIdAndUpdate(portfolioId, {
    $set: {
      "layout.type": layoutType,
      "layout.blocks": blocks,
      updatedAt: new Date(),
    },
  });

  // Return updated portfolio
  const updatedPortfolio = await Portfolio.findById(portfolioId);
  return updatedPortfolio;
}

/**
 * Reorder blocks in a portfolio
 */
export async function reorderPortfolioBlocks(portfolioId, blockOrders, user) {
  await connectDB();

  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  // Check if portfolio can be edited
  if (user) {
    const editableError = checkPortfolioEditable(portfolio, user);
    if (editableError) {
      throw new Error(editableError.error);
    }
  }

  // Ensure blocks structure exists
  ensureBlocksStructure(portfolio);

  // Get blocks
  const blocks = getBlocksFromPortfolio(portfolio);

  // Validate that all block IDs in blockOrders exist in portfolio
  const blockIds = new Set(blocks.map((b) => b.id));
  for (const orderItem of blockOrders) {
    if (!blockIds.has(orderItem.blockId)) {
      throw new Error(`Block ${orderItem.blockId} not found in portfolio`);
    }
  }

  // Create a map of new orders
  const orderMap = new Map();
  for (const orderItem of blockOrders) {
    orderMap.set(orderItem.blockId, orderItem.order);
  }

  // Update block orders
  blocks.forEach((block) => {
    if (orderMap.has(block.id)) {
      block.order = orderMap.get(block.id);
    }
  });

  // Sort blocks by order
  blocks.sort((a, b) => a.order - b.order);

  // Update portfolio
  const layoutType =
    typeof portfolio.layout === "string"
      ? portfolio.layout
      : portfolio.layout?.type || "single-page";

  await Portfolio.findByIdAndUpdate(portfolioId, {
    $set: {
      "layout.type": layoutType,
      "layout.blocks": blocks,
      updatedAt: new Date(),
    },
  });

  // Return updated portfolio
  const updatedPortfolio = await Portfolio.findById(portfolioId);
  
  // Trigger rating recalculation if achievement/certificate block was added
  const isAchievementBlock = newBlock.type === "achievements" || newBlock.type === "certificates";
  if (isAchievementBlock) {
    try {
      const { recalculatePortfolioRating } = await import("./portfolio-rating.js");
      await recalculatePortfolioRating(portfolioId);
    } catch (error) {
      console.error("Error recalculating rating after block add:", error);
      // Continue even if recalculation fails
    }
  }
  
  return updatedPortfolio;
}

/**
 * Delete a block from a portfolio
 */
export async function deletePortfolioBlock(portfolioId, blockId, user) {
  await connectDB();

  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  // Check if portfolio can be edited
  if (user) {
    const editableError = checkPortfolioEditable(portfolio, user);
    if (editableError) {
      throw new Error(editableError.error);
    }
  }

  // Ensure blocks structure exists
  ensureBlocksStructure(portfolio);

  // Get blocks
  const blocks = getBlocksFromPortfolio(portfolio);
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    throw new Error("Block not found");
  }

  // Remove block
  blocks.splice(blockIndex, 1);

  // Reorder remaining blocks
  blocks.forEach((block, index) => {
    block.order = index;
  });

  // Update portfolio
  const layoutType =
    typeof portfolio.layout === "string"
      ? portfolio.layout
      : portfolio.layout?.type || "single-page";

  await Portfolio.findByIdAndUpdate(portfolioId, {
    $set: {
      "layout.type": layoutType,
      "layout.blocks": blocks,
      updatedAt: new Date(),
    },
  });

  // Return updated portfolio
  const updatedPortfolio = await Portfolio.findById(portfolioId);
  return updatedPortfolio;
}

/**
 * Filter blocks by visibility and verification status based on viewer role and ownership
 */
export function filterBlocksByVisibility(blocks, viewerRole, isOwner) {
  if (!blocks || !Array.isArray(blocks)) {
    return [];
  }

  return blocks
    .map((block) => {
      // Ensure verification structure exists
      const blockWithVerification = ensureVerificationStructure(block);

      // Owner sees all blocks with full verification data
      if (isOwner) {
        return blockWithVerification;
      }

      // Public/University view: Hide rejected blocks
      if (blockWithVerification.verification?.status === "rejected") {
        return null; // Filter out rejected blocks
      }

      // Filter verification metadata for non-owners
      const filteredBlock = {
        ...blockWithVerification,
        verification: {
          status: blockWithVerification.verification?.status || "unverified",
          verifiedBy: blockWithVerification.verification?.verifiedBy || null,
          verifiedAt: blockWithVerification.verification?.verifiedAt || null,
          // Hide sensitive fields from public
          verifiedById: undefined,
          note: undefined, // Hide admin notes
          rejectionReason: undefined, // Hide rejection reasons
          requestedAt: blockWithVerification.verification?.requestedAt || null,
        },
      };

      // Only show public blocks
      if (blockWithVerification.visibility !== "public") {
        return null;
      }

      return filteredBlock;
    })
    .filter((block) => block !== null); // Remove null entries (rejected/private blocks)
}

export default {
  createPortfolio,
  findPortfolioById,
  findPortfolioBySlug,
  findPortfoliosByStudentId,
  findPublicPortfolios,
  updatePortfolio,
  deletePortfolio,
  slugExists,
  addCertificateToPortfolio,
  removeCertificateFromPortfolio,
  filterPersonalData,
  updatePortfolioBlock,
  addBlockToPortfolio,
  reorderPortfolioBlocks,
  deletePortfolioBlock,
  filterBlocksByVisibility,
};
