import { z } from "zod";
import { AWB_REGEX } from "./constants";

export const loginSchema = z.object({
  email: z.email({ message: "Masukkan email yang valid." }),
  password: z.string().min(6, "Password minimal 6 karakter."),
  remember: z.boolean().optional().default(false),
});

export const shipmentCreateSchema = z.object({
  awb: z.string().trim().optional().default(""),
  commodity: z.string().trim().min(2, "Komoditas wajib diisi."),
  origin: z.string().trim().min(3),
  destination: z.string().trim().min(3),
  pieces: z.coerce.number().int().positive("Pieces harus lebih dari 0."),
  weightKg: z.coerce.number().positive("Berat harus lebih dari 0."),
  volumeM3: z.coerce.number().optional().nullable(),
  specialHandling: z.string().trim().optional().default(""),
  shipper: z.string().trim().min(2),
  consignee: z.string().trim().min(2),
  forwarder: z.string().trim().min(2),
  ownerName: z.string().trim().min(2),
  flightId: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().default(""),
});

export const shipmentUpdateSchema = z.object({
  status: z
    .enum(["received", "sortation", "loaded_to_aircraft", "departed", "arrived", "hold"])
    .optional(),
  notes: z.string().trim().optional(),
  ownerName: z.string().trim().optional(),
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
  role: z.enum(["admin", "supervisor", "operator", "customer"]),
  station: z.string().trim().min(3),
});

export const userRoleUpdateSchema = z.object({
  role: z.enum(["admin", "supervisor", "operator", "customer"]).optional(),
  status: z.enum(["active", "invited", "disabled"]).optional(),
  station: z.string().trim().min(3).optional(),
});
