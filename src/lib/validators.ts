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
  customerAccountId: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().default(""),
});

export const shipmentUpdateSchema = z.object({
  status: z
    .enum(["received", "sortation", "loaded_to_aircraft", "departed", "arrived", "hold"])
    .optional(),
  notes: z.string().trim().optional(),
  ownerName: z.string().trim().optional(),
  flightId: z.string().trim().optional().nullable(),
  customerAccountId: z.string().trim().optional().nullable(),
  docStatus: z.string().trim().optional(),
  readiness: z.string().trim().optional(),
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
  role: z.enum(["admin", "operator", "supervisor", "customer"]),
  station: z.string().trim().min(3),
  customerAccountId: z.string().trim().optional().nullable(),
});

export const userRoleUpdateSchema = z.object({
  role: z.enum(["admin", "operator", "supervisor", "customer"]).optional(),
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
  flightNumber: z.string().trim().min(3, "Nomor flight wajib diisi."),
  aircraftType: z.string().trim().min(2, "Jenis pesawat wajib diisi."),
  origin: z.string().trim().min(3),
  destination: z.string().trim().min(3),
  departureTime: z.string().datetime({ offset: true }),
  arrivalTime: z.string().datetime({ offset: true }),
  cargoCutoffTime: z.string().datetime({ offset: true }),
  status: z.enum(["on_time", "delayed", "departed"]),
  gate: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
});

export const flightUpdateSchema = z.object({
  flightNumber: z.string().trim().min(3).optional(),
  aircraftType: z.string().trim().min(2).optional(),
  origin: z.string().trim().min(3).optional(),
  destination: z.string().trim().min(3).optional(),
  departureTime: z.string().datetime({ offset: true }).optional(),
  arrivalTime: z.string().datetime({ offset: true }).optional(),
  cargoCutoffTime: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["on_time", "delayed", "departed"]).optional(),
  gate: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  archived: z.boolean().optional(),
});
