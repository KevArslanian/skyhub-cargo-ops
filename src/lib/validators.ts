import { z } from "zod";
import { AWB_REGEX } from "./constants";
import { FLIGHT_NUMBER_REGEX } from "./flight-meta";

export const shipmentStatusSchema = z.enum(["received", "sortation", "loaded_to_aircraft", "departed", "arrived", "hold"]);
export const flightStatusSchema = z.enum(["on_time", "delayed", "departed"]);
export const shipmentDocStatusSchema = z.enum(["Complete", "Partial", "Review"]);
export const shipmentReadinessSchema = z.enum(["Ready", "Pending"]);

const optionalAwbSchema = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((value) => !value || AWB_REGEX.test(value), {
    message: "Format AWB harus XXX-XXXXXXXX.",
  });

const optionalPositiveVolumeSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().positive("Volume harus lebih dari 0.").optional().nullable(),
);

function validateFlightDateOrder<T extends { cargoCutoffTime?: string; departureTime?: string; arrivalTime?: string }>(
  value: T,
  context: z.RefinementCtx,
) {
  const providedDateFields = [value.cargoCutoffTime, value.departureTime, value.arrivalTime].filter(Boolean).length;
  const cutoff = value.cargoCutoffTime ? new Date(value.cargoCutoffTime).getTime() : null;
  const departure = value.departureTime ? new Date(value.departureTime).getTime() : null;
  const arrival = value.arrivalTime ? new Date(value.arrivalTime).getTime() : null;

  if (providedDateFields > 0 && providedDateFields < 3) {
    context.addIssue({
      code: "custom",
      path: ["departureTime"],
      message: "Cargo cutoff, waktu berangkat, dan waktu tiba harus dikirim bersama.",
    });
    return;
  }

  if (cutoff !== null && departure !== null && cutoff > departure) {
    context.addIssue({
      code: "custom",
      path: ["cargoCutoffTime"],
      message: "Cargo cutoff harus sebelum atau sama dengan waktu berangkat.",
    });
  }

  if (departure !== null && arrival !== null && departure > arrival) {
    context.addIssue({
      code: "custom",
      path: ["arrivalTime"],
      message: "Waktu tiba harus setelah atau sama dengan waktu berangkat.",
    });
  }
}

export const loginSchema = z.object({
  email: z.email({ message: "Masukkan email yang valid." }),
  password: z.string().min(6, "Password minimal 6 karakter."),
  remember: z.boolean().optional().default(false),
});

export const shipmentCreateSchema = z.object({
  awb: optionalAwbSchema,
  commodity: z.string().trim().min(2, "Komoditas wajib diisi."),
  origin: z.string().trim().min(3),
  destination: z.string().trim().min(3),
  pieces: z.coerce.number().int().positive("Pieces harus lebih dari 0."),
  weightKg: z.coerce.number().positive("Berat harus lebih dari 0."),
  volumeM3: optionalPositiveVolumeSchema,
  specialHandling: z.string().trim().optional().default(""),
  shipper: z.string().trim().min(2),
  consignee: z.string().trim().min(2),
  forwarder: z.string().trim().min(2),
  ownerName: z.string().trim().min(2),
  flightId: z.string().trim().optional().nullable(),
  customerAccountId: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().default(""),
});

export const shipmentUpdateSchema = z.object({
  status: shipmentStatusSchema.optional(),
  notes: z.string().trim().optional(),
  ownerName: z.string().trim().optional(),
  flightId: z.string().trim().optional().nullable(),
  customerAccountId: z.string().trim().optional().nullable(),
  docStatus: shipmentDocStatusSchema.optional(),
  readiness: shipmentReadinessSchema.optional(),
});

export const shipmentArchiveSchema = z.object({
  archived: z.boolean(),
});

export const awbSearchSchema = z.object({
  awb: z
    .string()
    .trim()
    .regex(AWB_REGEX, "Format AWB harus XXX-XXXXXXXX."),
});

export const settingsUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  station: z.string().trim().min(3).optional(),
  compactRows: z.boolean().optional(),
  sidebarCollapsed: z.boolean().optional(),
  autoRefresh: z.boolean().optional(),
  refreshIntervalSeconds: z.coerce.number().int().min(5).max(60).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  cutoffAlert: z.boolean().optional(),
  exceptionAlert: z.boolean().optional(),
  soundAlert: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
});

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  role: z.enum(["admin", "staff", "customer"]),
  station: z.string().trim().min(3),
  customerAccountId: z.string().trim().optional().nullable(),
});

export const userRoleUpdateSchema = z.object({
  role: z.enum(["admin", "staff", "customer"]).optional(),
  status: z.enum(["active", "invited", "disabled"]).optional(),
  station: z.string().trim().min(3).optional(),
  customerAccountId: z.string().trim().optional().nullable(),
});

export const customerAccountCreateSchema = z.object({
  code: z.string().trim().min(2, "Kode akun wajib diisi."),
  name: z.string().trim().min(2, "Nama akun wajib diisi."),
  contactName: z.string().trim().optional().default(""),
  contactEmail: z.string().trim().optional().default("").refine((value) => !value || z.email().safeParse(value).success, {
    message: "Email kontak tidak valid.",
  }),
  contactPhone: z.string().trim().optional().default(""),
});

export const customerAccountUpdateSchema = z.object({
  code: z.string().trim().min(2).optional(),
  name: z.string().trim().min(2).optional(),
  contactName: z.string().trim().optional(),
  contactEmail: z.string().trim().optional().refine((value) => value === undefined || !value || z.email().safeParse(value).success, {
    message: "Email kontak tidak valid.",
  }),
  contactPhone: z.string().trim().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export const flightCreateSchema = z.object({
  flightNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => FLIGHT_NUMBER_REGEX.test(value), {
      message: "Format flight harus CODE-XXX/XXXX dengan kode maskapai yang tersedia.",
    }),
  aircraftType: z.string().trim().min(2, "Jenis pesawat wajib diisi."),
  origin: z.string().trim().min(3),
  destination: z.string().trim().min(3),
  departureTime: z.string().datetime({ offset: true }),
  arrivalTime: z.string().datetime({ offset: true }),
  cargoCutoffTime: z.string().datetime({ offset: true }),
  status: flightStatusSchema,
  gate: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
}).superRefine(validateFlightDateOrder);

export const flightUpdateSchema = z.object({
  flightNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => FLIGHT_NUMBER_REGEX.test(value), {
      message: "Format flight harus CODE-XXX/XXXX dengan kode maskapai yang tersedia.",
    })
    .optional(),
  aircraftType: z.string().trim().min(2).optional(),
  origin: z.string().trim().min(3).optional(),
  destination: z.string().trim().min(3).optional(),
  departureTime: z.string().datetime({ offset: true }).optional(),
  arrivalTime: z.string().datetime({ offset: true }).optional(),
  cargoCutoffTime: z.string().datetime({ offset: true }).optional(),
  status: flightStatusSchema.optional(),
  gate: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  archived: z.boolean().optional(),
}).superRefine(validateFlightDateOrder);

export const shipmentListQuerySchema = z.object({
  query: z.string().trim().optional(),
  status: z.union([shipmentStatusSchema, z.literal("all")]).optional(),
  flight: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => value === "ALL" || FLIGHT_NUMBER_REGEX.test(value), {
      message: "Filter flight harus berisi nomor flight valid.",
    })
    .transform((value) => (value === "ALL" ? "all" : value))
    .optional(),
  sortBy: z.enum(["updated", "received", "priority"]).optional(),
});

export const flightListQuerySchema = z.object({
  query: z.string().trim().optional(),
  status: z.union([flightStatusSchema, z.literal("all")]).optional(),
});
