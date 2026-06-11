import { z } from "zod";
import {
  AIR_CARGO_MODE,
  AIR_VEHICLE_TYPE,
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
import {
  DATE_TO_BEFORE_FROM_MESSAGE,
  DATE_TO_MAX_TODAY_MESSAGE,
  getOpsTodayIso,
} from "./date-input";
import { buildShipmentSubmitPayload, DEFAULT_PIECES } from "./shipment-payload";

export const shipmentStatusSchema = z.enum(["received", "sortation", "loaded_to_aircraft", "departed", "arrived", "hold"]);
export const flightStatusSchema = z.enum(["on_time", "delayed", "departed"]);
export const shipmentDocStatusSchema = z.enum(["Complete", "Partial", "Review"]);
export const shipmentReadinessSchema = z.enum(["Ready", "Pending"]);
export const shipmentGoodsStatusSchema = z.enum(GOODS_STATUS_OPTIONS);
export const shipmentTransactionStatusSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().replaceAll(" ", "_") : value),
  z.enum(TRANSACTION_STATUS_OPTIONS),
);

export const NAME_NO_DIGITS_REGEX = /^[^0-9]*$/;

export function computeAwbCheckDigit(serial7: string | number) {
  const normalized = String(serial7).padStart(7, "0").slice(-7);
  return parseInt(normalized, 10) % 7;
}

export function buildAwbFromSerial(prefix: string, serial7: string | number) {
  const normalized = String(serial7).padStart(7, "0").slice(-7);
  return `${prefix}-${normalized}${computeAwbCheckDigit(normalized)}`;
}

export function isValidAwbChecksum(value: string) {
  const parts = value.split("-");
  const serial = parts[1];
  if (!serial || serial.length !== 8) return false;
  const first7 = parseInt(serial.slice(0, 7), 10);
  const checkDigit = parseInt(serial.slice(7), 10);
  return computeAwbCheckDigit(first7) === checkDigit;
}

const COMMODITY_TEXT_REGEX = /^[a-zA-Z\s.,\-&()]+$/;

const personNameSchema = z
  .string()
  .trim()
  .min(2)
  .refine((value) => NAME_NO_DIGITS_REGEX.test(value), {
    message: "Nama tidak boleh mengandung angka.",
  });

const commodityTextSchema = z
  .string()
  .trim()
  .min(2, "Komoditas wajib diisi.")
  .refine((value) => COMMODITY_TEXT_REGEX.test(value), {
    message: "Komoditas harus berupa huruf dan spasi, tidak boleh angka atau simbol khusus.",
  });

const optionalAwbSchema = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((value) => !value || AWB_REGEX.test(value), {
    message: "Format AWB harus XXX-XXXXXXXX.",
  })
  .refine((value) => !value || isValidAwbChecksum(value), {
    message: "Digit terakhir nomor resi tidak sesuai. Periksa penulisan atau biarkan kosong agar sistem membuat nomor otomatis.",
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

function validateFilterDateRangeQuery(
  value: { dateFrom?: string; dateTo?: string; date?: string },
  context: z.RefinementCtx,
) {
  const start = value.dateFrom ?? value.date;
  const end = value.dateTo ?? value.dateFrom ?? value.date;
  const todayIso = getOpsTodayIso();

  if (start && end && end < start) {
    context.addIssue({
      code: "custom",
      path: ["dateTo"],
      message: DATE_TO_BEFORE_FROM_MESSAGE,
    });
  }

  if (end && end > todayIso) {
    context.addIssue({
      code: "custom",
      path: ["dateTo"],
      message: DATE_TO_MAX_TODAY_MESSAGE,
    });
  }
}

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
  commodity: commodityTextSchema,
  cargoMode: z.literal(AIR_CARGO_MODE).optional().default(AIR_CARGO_MODE),
  senderPhone: requiredPhoneSchema,
  origin: z.enum(STATION_OPTIONS),
  destination: z.enum(STATION_OPTIONS),
  pieces: z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? DEFAULT_PIECES : value),
    z.coerce.number().int().positive().default(DEFAULT_PIECES),
  ),
  weightKg: z.coerce.number().positive("Berat harus lebih dari 0."),
  volumeM3: optionalPositiveVolumeSchema,
  specialHandling: z.string().trim().optional().default(""),
  serviceType: z.enum(SERVICE_TYPE_OPTIONS).optional().default("Standard"),
  shippingRate: z.coerce.number().int().min(0).optional(),
  vehicleName: z.string().trim().min(2, "Nama kendaraan wajib diisi.").optional().default("SkyHub 01"),
  vehicleType: z.literal(AIR_VEHICLE_TYPE).optional().default(AIR_VEHICLE_TYPE),
  vehicleCode: z.string().trim().min(2, "Kode kendaraan wajib diisi.").optional().default("PK-SHA"),
  vehicleCapacityKg: z.coerce.number().int().positive("Kapasitas harus lebih dari 0.").optional().default(1000),
  vehicleStatus: z.enum(VEHICLE_STATUS_OPTIONS).optional().default("Aktif"),
  shipper: personNameSchema,
  consignee: personNameSchema,
  forwarder: personNameSchema,
  shiftOwnerId: z.string().trim().min(1, "Pilih penanggung jawab shift."),
  shiftOwnerPhone: optionalPhoneSchema,
  flightId: z.string().trim().optional().nullable(),
  customerAccountId: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().default(""),
  docStatus: shipmentDocStatusSchema.optional().default("Partial"),
})
  .superRefine((value, context) => {
    if (value.origin === value.destination) {
      context.addIssue({
        code: "custom",
        path: ["destination"],
        message: "Kota tujuan harus berbeda dari kota asal.",
      });
    }
  })
  .transform((value) => buildShipmentSubmitPayload(value));

export const shipmentUpdateSchema = z
  .object({
    status: shipmentStatusSchema.optional(),
    notes: z.string().trim().optional(),
    shiftOwnerId: z.string().trim().min(1, "Pilih penanggung jawab shift.").optional(),
    shiftOwnerPhone: optionalPhoneSchema,
    sentAt: optionalCargoDateSchema,
    cargoMode: z.literal(AIR_CARGO_MODE).optional(),
    senderPhone: optionalPhoneSchema,
    commodity: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || COMMODITY_TEXT_REGEX.test(value), {
        message: "Komoditas harus berupa huruf dan spasi, tidak boleh angka atau simbol khusus.",
      }),
    origin: z.enum(STATION_OPTIONS).optional(),
    destination: z.enum(STATION_OPTIONS).optional(),
    pieces: z.coerce.number().int().positive().optional(),
    weightKg: z.coerce.number().positive().optional(),
    serviceType: z.enum(SERVICE_TYPE_OPTIONS).optional(),
    shippingRate: z.coerce.number().int().min(0).optional(),
    goodsStatus: shipmentGoodsStatusSchema.optional(),
    transactionStatus: shipmentTransactionStatusSchema.optional(),
    vehicleName: z.string().trim().min(2).optional(),
    vehicleType: z.literal(AIR_VEHICLE_TYPE).optional(),
    vehicleCode: z.string().trim().min(2).optional(),
    vehicleCapacityKg: z.coerce.number().int().positive().optional(),
    vehicleStatus: z.enum(VEHICLE_STATUS_OPTIONS).optional(),
    flightId: z.string().trim().optional().nullable(),
    customerAccountId: z.string().trim().optional().nullable(),
    docStatus: shipmentDocStatusSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.origin && value.destination && value.origin === value.destination) {
      context.addIssue({
        code: "custom",
        path: ["destination"],
        message: "Kota tujuan harus berbeda dari kota asal.",
      });
    }
  })
  .transform((value) => {
    const shouldRecomputeRate =
      value.serviceType !== undefined ||
      value.weightKg !== undefined ||
      value.origin !== undefined ||
      value.destination !== undefined;

    const next = buildShipmentSubmitPayload({
      ...value,
      cargoMode: value.cargoMode ?? AIR_CARGO_MODE,
      serviceType: value.serviceType,
      weightKg: value.weightKg,
      origin: value.origin,
      destination: value.destination,
    });

    return {
      ...value,
      pieces: DEFAULT_PIECES,
      vehicleType: AIR_VEHICLE_TYPE,
      cargoMode: value.cargoMode ?? AIR_CARGO_MODE,
      shippingRate: shouldRecomputeRate ? next.shippingRate : value.shippingRate,
    };
  });

export const shipmentArchiveSchema = z.object({
  archived: z.boolean(),
});

/** Pencarian/tracking: cek format saja; ketemu atau tidak ditentukan di basis data. */
export const awbLookupSchema = z.object({
  awb: z
    .string()
    .trim()
    .regex(AWB_REGEX, "Format nomor resi harus XXX-XXXXXXXX, contoh: 160-10000001."),
});

/** Pelacakan publik landing page: format AWB + verifikasi robot sekali pakai. */
export const publicAwbTrackingQuerySchema = awbLookupSchema.extend({
  challengeId: z.string().uuid("Verifikasi robot kedaluwarsa. Muat ulang lalu coba lagi."),
  challengeAnswer: z.coerce
    .number()
    .int("Jawaban verifikasi harus angka bulat.")
    .min(0, "Jawaban verifikasi tidak valid."),
});

/** @deprecated Gunakan awbLookupSchema untuk pencarian. Nama dipertahankan agar impor lama tetap jalan. */
export const awbSearchSchema = awbLookupSchema;

export const settingsUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  compactRows: z.boolean().optional(),
  sidebarCollapsed: z.boolean().optional(),
  autoRefresh: z.boolean().optional(),
  refreshIntervalSeconds: z.coerce.number().int().min(5).max(60).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  soundAlert: z.boolean().optional(),
  accentColor: z.enum(["blue", "teal", "amber", "rose", "violet"]).optional(),
});

export const inviteUserSchema = z
  .object({
    name: personNameSchema,
    email: z.email(),
    role: z.enum(["admin", "staff"]),
    station: z.enum(STATION_OPTIONS),
    phone: optionalPhoneSchema,
    customerAccountId: z.string().trim().optional().nullable(),
    password: z.string().min(6, "Kata sandi minimal 6 karakter."),
    confirmPassword: z.string().min(6, "Konfirmasi kata sandi wajib diisi."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"],
  });

export const userRoleUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.email().optional(),
  role: z.enum(["admin", "staff", "customer"]).optional(),
  status: z.enum(["active", "invited", "disabled"]).optional(),
  station: z.enum(STATION_OPTIONS).optional(),
  phone: optionalPhoneSchema,
  customerAccountId: z.string().trim().optional().nullable(),
  capabilities: z
    .array(
      z.enum([
        "shipment:create",
        "shipment:update",
        "shipment:delete",
        "shipment:document",
        "flight:manage",
        "reports:export",
        "users:manage",
        "customer_accounts:manage",
        "settings:workspace",
      ]),
    )
    .optional(),
});

export const adminResetPasswordSchema = z
  .object({
    password: z.string().min(6, "Kata sandi baru minimal 6 karakter."),
    confirmPassword: z.string().min(6, "Konfirmasi kata sandi wajib diisi."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Konfirmasi kata sandi tidak sama.",
    path: ["confirmPassword"],
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
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
}).superRefine(validateFilterDateRangeQuery);

export const awbRecentQuerySchema = z.object({
  dateFrom: optionalDateRangeSchema,
  dateTo: optionalDateRangeSchema,
}).superRefine(validateFilterDateRangeQuery);

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
}).superRefine(validateFilterDateRangeQuery);

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
export const complaintStatusSchema = z.enum(["new", "in_review", "escalated", "resolved", "closed"]);

export const publicComplaintCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama wajib diisi.")
    .max(120, "Nama terlalu panjang.")
    .refine((value) => NAME_NO_DIGITS_REGEX.test(value), {
      message: "Nama tidak boleh mengandung angka.",
    }),
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

export const complaintStatusUpdateSchema = z
  .object({
    status: complaintStatusSchema,
    resolutionNote: z.string().trim().max(500, "Catatan penyelesaian maksimal 500 karakter.").optional().nullable(),
    escalationReason: z.string().trim().max(500, "Alasan eskalasi maksimal 500 karakter.").optional().nullable(),
  })
  .superRefine((value, context) => {
    if (value.status === "resolved" && (!value.resolutionNote || value.resolutionNote.trim().length < 8)) {
      context.addIssue({
        code: "custom",
        path: ["resolutionNote"],
        message: "Catatan penyelesaian minimal 8 karakter.",
      });
    }
    if (value.status === "escalated" && (!value.escalationReason || value.escalationReason.trim().length < 8)) {
      context.addIssue({
        code: "custom",
        path: ["escalationReason"],
        message: "Alasan eskalasi minimal 8 karakter.",
      });
    }
  });

