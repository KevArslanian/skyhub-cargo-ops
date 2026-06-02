import { z } from "zod";
import {
  AIRCRAFT_TYPE_OPTIONS,
  AWB_REGEX,
  CARGO_MODE_OPTIONS,
  GOODS_STATUS_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  STATION_OPTIONS,
  TRANSACTION_STATUS_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "./constants";
import { FLIGHT_NUMBER_REGEX } from "./flight-meta";

export const shipmentStatusSchema = z.enum(["received", "sortation", "loaded_to_aircraft", "departed", "arrived", "hold"]);
export const flightStatusSchema = z.enum(["on_time", "delayed", "departed"]);
export const shipmentDocStatusSchema = z.enum(["Complete", "Partial", "Review"]);
export const shipmentReadinessSchema = z.enum(["Ready", "Pending"]);
export const shipmentGoodsStatusSchema = z.enum(GOODS_STATUS_OPTIONS);
export const shipmentTransactionStatusSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().replaceAll(" ", "_") : value),
  z.enum(TRANSACTION_STATUS_OPTIONS),
);

const optionalAwbSchema = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((value) => !value || AWB_REGEX.test(value), {
    message: "Format AWB harus XXX-XXXXXXXX.",
  });

const PHONE_REGEX = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;

const requiredPhoneSchema = z
  .string()
  .trim()
  .min(8, "No telepon wajib diisi.")
  .regex(PHONE_REGEX, "No telepon tidak valid. Gunakan format Indonesia, contoh: 08123456789.");

const optionalPhoneSchema = requiredPhoneSchema.optional();

const optionalPositiveVolumeSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().positive("Volume harus lebih dari 0.").optional().nullable(),
);

const optionalCargoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal kirim harus format YYYY-MM-DD.")
  .optional();

const optionalDateRangeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal filter harus format YYYY-MM-DD.")
  .optional();

function validateFlightDateOrder<T extends { cargoCutoffTime?: string; departureTime?: string; arrivalTime?: string }>(
  value: T,
  context: z.RefinementCtx,
) {
  const cutoff = value.cargoCutoffTime ? new Date(value.cargoCutoffTime).getTime() : null;
  const departure = value.departureTime ? new Date(value.departureTime).getTime() : null;
  const arrival = value.arrivalTime ? new Date(value.arrivalTime).getTime() : null;

  if ((cutoff !== null || arrival !== null) && departure === null) {
    context.addIssue({
      code: "custom",
      path: ["departureTime"],
      message: "Waktu berangkat wajib dikirim jika batas kargo atau estimasi tiba dikirim.",
    });
    return;
  }

  if (cutoff !== null && departure !== null && cutoff > departure) {
    context.addIssue({
      code: "custom",
      path: ["cargoCutoffTime"],
      message: "Batas kargo harus sebelum atau sama dengan waktu berangkat.",
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
  password: z.string().min(6, "Kata sandi minimal 6 karakter."),
  remember: z.boolean().optional().default(false),
});

export const shipmentCreateSchema = z.object({
  awb: optionalAwbSchema,
  sentAt: optionalCargoDateSchema,
  commodity: z.string().trim().min(2, "Komoditas wajib diisi."),
  cargoMode: z.enum(CARGO_MODE_OPTIONS).optional().default("Udara"),
  senderPhone: requiredPhoneSchema,
  origin: z.enum(STATION_OPTIONS),
  destination: z.enum(STATION_OPTIONS),
  pieces: z.coerce.number().int().positive("Pieces harus lebih dari 0."),
  weightKg: z.coerce.number().positive("Berat harus lebih dari 0."),
  volumeM3: optionalPositiveVolumeSchema,
  specialHandling: z.string().trim().optional().default(""),
  serviceType: z.enum(SERVICE_TYPE_OPTIONS).optional().default("Biasa"),
  shippingRate: z.coerce.number().int().min(0, "Tarif tidak boleh negatif.").optional().default(0),
  vehicleName: z.string().trim().min(2, "Nama kendaraan wajib diisi.").optional().default("SkyHub 01"),
  vehicleType: z.enum(VEHICLE_TYPE_OPTIONS).optional().default("Pesawat"),
  vehicleCode: z.string().trim().min(2, "Kode kendaraan wajib diisi.").optional().default("PK-SHA"),
  vehicleCapacityKg: z.coerce.number().int().positive("Kapasitas harus lebih dari 0.").optional().default(1000),
  vehicleStatus: z.enum(VEHICLE_STATUS_OPTIONS).optional().default("Aktif"),
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
  sentAt: optionalCargoDateSchema,
  cargoMode: z.enum(CARGO_MODE_OPTIONS).optional(),
  senderPhone: optionalPhoneSchema,
  commodity: z.string().trim().min(2).optional(),
  origin: z.enum(STATION_OPTIONS).optional(),
  destination: z.enum(STATION_OPTIONS).optional(),
  pieces: z.coerce.number().int().positive().optional(),
  weightKg: z.coerce.number().positive().optional(),
  serviceType: z.enum(SERVICE_TYPE_OPTIONS).optional(),
  shippingRate: z.coerce.number().int().min(0).optional(),
  goodsStatus: shipmentGoodsStatusSchema.optional(),
  transactionStatus: shipmentTransactionStatusSchema.optional(),
  vehicleName: z.string().trim().min(2).optional(),
  vehicleType: z.enum(VEHICLE_TYPE_OPTIONS).optional(),
  vehicleCode: z.string().trim().min(2).optional(),
  vehicleCapacityKg: z.coerce.number().int().positive().optional(),
  vehicleStatus: z.enum(VEHICLE_STATUS_OPTIONS).optional(),
  flightId: z.string().trim().optional().nullable(),
  customerAccountId: z.string().trim().optional().nullable(),
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
  station: z.enum(STATION_OPTIONS).optional(),
  compactRows: z.boolean().optional(),
  sidebarCollapsed: z.boolean().optional(),
  autoRefresh: z.boolean().optional(),
  refreshIntervalSeconds: z.coerce.number().int().min(5).max(60).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  cutoffAlert: z.boolean().optional(),
  exceptionAlert: z.boolean().optional(),
  soundAlert: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
});

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  role: z.enum(["admin", "staff"]),
  station: z.enum(STATION_OPTIONS),
  customerAccountId: z.string().trim().optional().nullable(),
});

export const userRoleUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.email().optional(),
  role: z.enum(["admin", "staff"]).optional(),
  status: z.enum(["active", "invited", "disabled"]).optional(),
  station: z.enum(STATION_OPTIONS).optional(),
  customerAccountId: z.string().trim().optional().nullable(),
  capabilities: z
    .array(
      z.enum([
        "shipment:create",
        "shipment:update",
        "shipment:delete",
        "shipment:document",
        "flight:manage",
        "payment:verify",
        "reports:export",
        "users:manage",
        "customer_accounts:manage",
        "settings:workspace",
      ]),
    )
    .optional(),
});

export const customerAccountCreateSchema = z.object({
  code: z.string().trim().min(2, "Kode akun wajib diisi."),
  name: z.string().trim().min(2, "Nama akun wajib diisi."),
  contactName: z.string().trim().optional().default(""),
  contactEmail: z.string().trim().optional().default("").refine((value) => !value || z.email().safeParse(value).success, {
    message: "Surel kontak tidak valid.",
  }),
  contactPhone: z.string().trim().optional().default(""),
});

export const customerAccountUpdateSchema = z.object({
  code: z.string().trim().min(2).optional(),
  name: z.string().trim().min(2).optional(),
  contactName: z.string().trim().optional(),
  contactEmail: z.string().trim().optional().refine((value) => value === undefined || !value || z.email().safeParse(value).success, {
    message: "Surel kontak tidak valid.",
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
      message: "Format penerbangan harus CODE-XXX/XXXX dengan kode maskapai yang tersedia.",
    }),
  aircraftType: z.enum(AIRCRAFT_TYPE_OPTIONS),
  origin: z.enum(STATION_OPTIONS),
  destination: z.enum(STATION_OPTIONS),
  departureTime: z.string().datetime({ offset: true }),
  arrivalTime: z.string().datetime({ offset: true }).optional(),
  cargoCutoffTime: z.string().datetime({ offset: true }).optional(),
  status: flightStatusSchema.optional(),
  gate: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
}).superRefine(validateFlightDateOrder);

export const flightUpdateSchema = z.object({
  flightNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => FLIGHT_NUMBER_REGEX.test(value), {
      message: "Format penerbangan harus CODE-XXX/XXXX dengan kode maskapai yang tersedia.",
    })
    .optional(),
  aircraftType: z.enum(AIRCRAFT_TYPE_OPTIONS).optional(),
  origin: z.enum(STATION_OPTIONS).optional(),
  destination: z.enum(STATION_OPTIONS).optional(),
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
  status: z.union([shipmentStatusSchema, z.literal("all"), z.literal("delayed"), z.literal("review")]).optional(),
  flight: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => value === "ALL" || FLIGHT_NUMBER_REGEX.test(value), {
      message: "Filter penerbangan harus berisi nomor penerbangan valid.",
    })
    .transform((value) => (value === "ALL" ? "all" : value))
    .optional(),
  sortBy: z.enum(["updated", "received", "priority"]).optional(),
  dateFrom: optionalDateRangeSchema,
  dateTo: optionalDateRangeSchema,
}).superRefine((value, context) => {
  if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
    context.addIssue({
      code: "custom",
      path: ["dateTo"],
      message: "Tanggal akhir tidak boleh lebih awal dari tanggal awal.",
    });
  }
});

export const flightListQuerySchema = z.object({
  query: z.string().trim().optional(),
  status: z.union([flightStatusSchema, z.literal("all")]).optional(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateFrom: optionalDateRangeSchema,
  dateTo: optionalDateRangeSchema,
  shift: z.enum(["all", "pagi", "siang", "malam"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
}).superRefine((value, context) => {
  const start = value.dateFrom ?? value.date;
  const end = value.dateTo ?? value.dateFrom ?? value.date;

  if (start && end && end < start) {
    context.addIssue({
      code: "custom",
      path: ["dateTo"],
      message: "Tanggal akhir tidak boleh lebih awal dari tanggal awal.",
    });
  }
});

export const alertActionSchema = z
  .object({
    alertKey: z.string().trim().min(3, "Kunci peringatan wajib diisi."),
    action: z.enum(["acknowledge", "assign", "snooze", "resolve", "reopen"]),
    assigneeId: z.string().trim().min(1).optional().nullable(),
    snoozeMinutes: z.coerce.number().int().min(5).max(1440).optional().nullable(),
    note: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional().nullable(),
  })
  .superRefine((value, context) => {
    if (value.action === "assign" && !value.assigneeId) {
      context.addIssue({
        code: "custom",
        path: ["assigneeId"],
        message: "Pilih staf untuk penugasan peringatan.",
      });
    }
  });

export const complaintTopicSchema = z.enum(["shipment", "flight", "document", "service", "other"]);
export const complaintStatusSchema = z.enum(["new", "in_review", "resolved", "closed"]);

export const publicComplaintCreateSchema = z.object({
  name: z.string().trim().min(2, "Nama wajib diisi.").max(120, "Nama terlalu panjang."),
  contact: z
    .string()
    .trim()
    .min(5, "Kontak wajib diisi.")
    .max(120, "Kontak terlalu panjang.")
    .refine((value) => {
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const phoneValid = PHONE_REGEX.test(value.replace(/\s+/g, ""));
      return emailValid || phoneValid;
    }, "Gunakan email valid atau nomor Indonesia."),
  topic: complaintTopicSchema,
  referenceNo: z.string().trim().max(40, "Nomor referensi terlalu panjang.").optional().default(""),
  message: z.string().trim().min(12, "Ceritakan keluhan minimal 12 karakter.").max(2000, "Keluhan terlalu panjang."),
});

export const complaintListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.union([complaintStatusSchema, z.literal("all")]).optional().default("all"),
  topic: z.union([complaintTopicSchema, z.literal("all")]).optional().default("all"),
});

export const complaintStatusUpdateSchema = z.object({
  status: complaintStatusSchema,
  resolutionNote: z.string().trim().max(500, "Catatan penyelesaian maksimal 500 karakter.").optional().nullable(),
});

