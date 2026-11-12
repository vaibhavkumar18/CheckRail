
import { z } from "zod";

const countryCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}$/, "Invalid ISO country code"));

const uuidSchema = z.string().uuid("Invalid UUID");

const baseProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Project name must be at least 3 characters")
    .max(100, "Project name cannot exceed 100 characters"),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .default(""),
});

// Provider-specific project creation
export const createProjectSchema = z
  .discriminatedUnion("provider", [
    // PayPal Payment Testing
    baseProjectSchema.extend({
      provider: z.literal("PAYPAL"),
      assessmentObjective: z.literal("PAYMENT_TESTING"),
      integrationType: z.literal("PAYMENT"),
      sourceCountry: z.null(),
      targetCountries: z.array(countryCodeSchema).length(0),
    }),

    // Hyperwallet International Expansion
    baseProjectSchema.extend({
      provider: z.literal("HYPERWALLET"),
      assessmentObjective: z.literal("INTERNATIONAL_EXPANSION"),
      integrationType: z.literal("PAYOUT"),
      sourceCountry: countryCodeSchema,
      targetCountries: z
        .array(countryCodeSchema)
        .min(1, "Select at least one target country")
        .max(20, "Maximum 20 target countries allowed")
        .refine(
          (countries) => new Set(countries).size === countries.length,
          "Duplicate target countries are not allowed"
        ),
    }),
  ])
  .superRefine((data, ctx) => {
    if (
      data.provider === "HYPERWALLET" &&
      data.targetCountries.includes(data.sourceCountry)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["targetCountries"],
        message: "Source country cannot also be a target country",
      });
    }
  });

// Only editable project metadata.
// Provider and assessment configuration remain immutable.
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(3).max(100).optional(),

    description: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one field to update"
  );

export const organizationIdParamsSchema = z.object({
  organizationId: uuidSchema,
});

export const projectIdParamsSchema = z.object({
  projectId: uuidSchema,
});

export const projectRouteParamsSchema = z.object({
  organizationId: uuidSchema,
  projectId: uuidSchema,
});

// Middleware factory: validates request body or URL parameters.
export const validate =
  (schema, property = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[property]);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req[property] = result.data;
    next();
  };

export const validateCreateProject = validate(createProjectSchema);
export const validateUpdateProject = validate(updateProjectSchema);

export const validateOrganizationId = validate(
  organizationIdParamsSchema,
  "params"
);

export const validateProjectId = validate(
  projectIdParamsSchema,
  "params"
);

export const validateProjectRouteParams = validate(
  projectRouteParamsSchema,
  "params"
);
