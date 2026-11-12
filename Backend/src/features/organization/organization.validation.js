import { z } from "zod";

// ==========================================
// 1. CREATE ORGANIZATION
// POST /createOrganization
// ==========================================

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must contain at least 2 characters")
    .max(150, "Organization name cannot exceed 150 characters"),
});

// ==========================================
// 2. UPDATE ORGANIZATION
// PUT /updateOrganization/:organizationId
// ==========================================

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must contain at least 2 characters")
    .max(150, "Organization name cannot exceed 150 characters"),
});

// ==========================================
// 3. ADD MEMBER
// POST /:organizationId/addMember
// ==========================================

export const addMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(120, "Name cannot exceed 120 characters"),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters")
    .transform((email) => email.toLowerCase()),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"),

  role: z.enum(["DEVELOPER", "REVIEWER"], {
    error: "Role must be DEVELOPER or REVIEWER",
  }),
});

// ==========================================
// 4. UPDATE MEMBER
// PUT /:organizationId/:memberId/updateMember
// ==========================================

export const updateMemberSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters")
      .max(120, "Name cannot exceed 120 characters")
      .optional(),

    email: z
      .string()
      .trim()
      .email("Please enter a valid email address")
      .max(255, "Email cannot exceed 255 characters")
      .transform((email) => email.toLowerCase())
      .optional(),

    role: z
      .enum(["DEVELOPER", "REVIEWER"], {
        error: "Role must be DEVELOPER or REVIEWER",
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.role !== undefined,
    {
      message: "Provide at least one field to update",
    },
  );

// ==========================================
// 5. PARAMETER VALIDATION
// ==========================================

const uuidSchema = z.string().uuid("Invalid UUID format");

export const organizationIdSchema = z.object({
  organizationId: uuidSchema,
});

export const memberParamsSchema = z.object({
  organizationId: uuidSchema,
  membershipId: uuidSchema,
});

// ==========================================
// 6. SEARCH EXISTING MEMBER
// GET /:organizationId/members/search?email=user@example.com
// ==========================================

export const searchExistingMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters")
    .transform((email) => email.toLowerCase()),
});

// ==========================================
// 7. ADD EXISTING MEMBER
// POST /:organizationId/members/existing
// ==========================================

export const addExistingMemberSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),

  role: z.enum(["DEVELOPER", "REVIEWER"], {
    error: "Role must be DEVELOPER or REVIEWER",
  }),
});

// ==========================================
// 8. REUSABLE QUERY VALIDATION MIDDLEWARE
// ==========================================

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Query validation failed",
      errors: result.error.flatten().fieldErrors,
    });
  }

  // Use normalized/transformed query values.
  req.validatedQuery = result.data;
  next();
};

// ==========================================
// 9. EXPORTED MIDDLEWARE
// ==========================================

export const validateSearchExistingMember = validateQuery(
  searchExistingMemberSchema,
);


const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: result.error.flatten().fieldErrors,
        });
    }
    
    req.body = result.data;
    next();
};

// ==========================================
// 7. REUSABLE PARAMETER VALIDATION MIDDLEWARE
// ==========================================
export const validateAddExistingMember = validateBody(addExistingMemberSchema);

const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid route parameters",
      errors: result.error.flatten().fieldErrors,
    });
  }

  req.params = result.data;
  next();
};

// ==========================================
// 8. EXPORTED MIDDLEWARE
// ==========================================

export const validateCreateOrganization = validateBody(
  createOrganizationSchema,
);

export const validateUpdateOrganization = validateBody(
  updateOrganizationSchema,
);

export const validateAddMember = validateBody(addMemberSchema);

export const validateUpdateMember = validateBody(updateMemberSchema);

export const validateOrganizationId = validateParams(organizationIdSchema);

export const validateMemberParams = validateParams(memberParamsSchema);
