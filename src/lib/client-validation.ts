import { AIR_CARGO_MODE, AIR_VEHICLE_TYPE, AWB_REGEX } from "./constants";
import { buildShipmentSubmitPayload, DEFAULT_PIECES } from "./shipment-payload";
import {
  inviteUserSchema,
  isValidAwbChecksum,
  NAME_NO_DIGITS_REGEX,
  publicComplaintCreateSchema,
  shipmentCreateSchema,
  shipmentUpdateSchema,
} from "./validators";

export type FieldValidationResult = {
  ok: boolean;
  message?: string;
};

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export type ShipmentFlightContext = {
  id: string;
  origin: string;
  destination: string;
  availableCapacityKg: number;
  flightNumber: string;
};

export type ShipmentCreateFormField =
  | "sentAt"
  | "commodity"
  | "cargoMode"
  | "senderPhone"
  | "origin"
  | "destination"
  | "weightKg"
  | "volumeM3"
  | "serviceType"
  | "shipper"
  | "consignee"
  | "forwarder"
  | "ownerName"
  | "flightId"
  | "notes"
  | "specialHandling"
  | "docStatus";

export type ShipmentUpdateFormField =
  | "status"
  | "ownerName"
  | "notes"
  | "sentAt"
  | "cargoMode"
  | "senderPhone"
  | "commodity"
  | "origin"
  | "destination"
  | "weightKg"
  | "serviceType"
  | "goodsStatus"
  | "transactionStatus"
  | "flightId"
  | "docStatus";

export type ShipmentCreateFormErrors = FieldErrors<ShipmentCreateFormField>;
export type ShipmentUpdateFormErrors = FieldErrors<ShipmentUpdateFormField>;

export type FlightFormField = "flightNumberSuffix" | "origin" | "destination" | "departureTime";
export type FlightFormErrors = FieldErrors<FlightFormField>;

export type FlightScheduleIssue = {
  tone: "error" | "warning";
  message: string;
};

export type FlightFormValidationInput = {
  origin: string;
  destination: string;
  departureTime: string;
  flightNumberSuffix: string;
};

function isFlightNumberSuffixValid(value: string) {
  return /^\d{3,4}$/.test(value);
}

export function validateFlightFormDetailed(
  value: FlightFormValidationInput,
  scheduleIssues: FlightScheduleIssue[],
) {
  const errors: FlightFormErrors = {};

  if (value.origin === value.destination) {
    errors.destination = "Kota tujuan harus berbeda dari kota asal.";
  }

  if (!value.departureTime?.trim()) {
    errors.departureTime = "Waktu berangkat wajib diisi.";
  }

  if (!isFlightNumberSuffixValid(value.flightNumberSuffix)) {
    errors.flightNumberSuffix = "Nomor penerbangan harus terdiri dari 3-4 digit.";
  }

  const blockingIssue = scheduleIssues.find((issue) => issue.tone === "error");
  if (blockingIssue) {
    errors.departureTime = errors.departureTime ?? blockingIssue.message;
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAwbFormat(value: string): FieldValidationResult {
  const normalized = value.trim();
  if (!normalized) {
    return { ok: false, message: "Nomor resi wajib diisi." };
  }
  if (!AWB_REGEX.test(normalized)) {
    return { ok: false, message: "Format nomor resi harus XXX-XXXXXXXX, contoh: 160-10000001." };
  }
  return { ok: true };
}

/** mode lookup = tracking (format saja); mode strict = input operasional (termasuk digit pemeriksa). */
export function validateAwb(value: string, mode: "lookup" | "strict" = "lookup"): FieldValidationResult {
  const formatResult = validateAwbFormat(value);
  if (!formatResult.ok || mode === "lookup") {
    return formatResult;
  }

  const normalized = value.trim();
  if (!isValidAwbChecksum(normalized)) {
    return {
      ok: false,
      message: "Digit terakhir nomor resi tidak sesuai. Periksa penulisan atau minta nomor baru ke petugas.",
    };
  }
  return { ok: true };
}

export function mapZodFieldErrors<T extends string>(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Partial<Record<T, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || errors[field as T]) {
      continue;
    }
    errors[field as T] = issue.message;
  }
  return errors;
}

function applyShipmentBusinessRules(
  errors: ShipmentCreateFormErrors | ShipmentUpdateFormErrors,
  value: {
    origin?: string;
    destination?: string;
    weightKg?: number;
    flightId?: string | null;
  },
  context?: {
    flights?: ShipmentFlightContext[];
    activeFlight?: ShipmentFlightContext | null;
  },
) {
  const origin = value.origin?.toUpperCase();
  const destination = value.destination?.toUpperCase();

  if (origin && destination && origin === destination) {
    errors.destination = "Kota tujuan harus berbeda dari kota asal.";
  }

  const weightKg = Number(value.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return;
  }

  const flights = context?.flights ?? [];
  const explicitFlightId = typeof value.flightId === "string" ? value.flightId.trim() : "";
  const selectedFlight = explicitFlightId
    ? flights.find((flight) => flight.id === explicitFlightId) ?? null
    : context?.activeFlight ?? null;

  if (explicitFlightId && !selectedFlight) {
    errors.flightId = "Penerbangan yang dipilih tidak tersedia atau sudah tidak aktif.";
    return;
  }

  if (!selectedFlight) {
    return;
  }

  if (origin && destination) {
    if (selectedFlight.origin !== origin || selectedFlight.destination !== destination) {
      const targetField = explicitFlightId ? "flightId" : "destination";
      errors[targetField] =
        `Penerbangan ${selectedFlight.flightNumber} melayani rute ${selectedFlight.origin}-${selectedFlight.destination}, bukan ${origin}-${destination}.`;
    }
  }

  if (weightKg > selectedFlight.availableCapacityKg) {
    errors.weightKg = `Berat ${weightKg} kg melebihi sisa kapasitas penerbangan (${Math.max(0, Math.round(selectedFlight.availableCapacityKg))} kg).`;
  }
}

export function validateComplaintForm(value: {
  name: string;
  contact: string;
  topic: "shipment" | "flight" | "document" | "service" | "other";
  referenceNo: string;
  message: string;
}) {
  const parsed = publicComplaintCreateSchema.safeParse(value);
  if (parsed.success) {
    return { ok: true as const, errors: {} };
  }
  return {
    ok: false as const,
    errors: mapZodFieldErrors<"name" | "contact" | "topic" | "referenceNo" | "message">(parsed.error.issues),
  };
}

export function validateShipmentCreateFormDetailed(
  value: Record<string, unknown>,
  context?: {
    flights?: ShipmentFlightContext[];
    activeFlight?: ShipmentFlightContext | null;
  },
) {
  const parsed = shipmentCreateSchema.safeParse(
    buildShipmentSubmitPayload({
      ...value,
      cargoMode: AIR_CARGO_MODE,
      vehicleType: AIR_VEHICLE_TYPE,
      pieces: DEFAULT_PIECES,
      awb: "",
    }),
  );

  const errors: ShipmentCreateFormErrors = parsed.success
    ? {}
    : mapZodFieldErrors<ShipmentCreateFormField>(parsed.error.issues);

  if (parsed.success) {
    applyShipmentBusinessRules(errors, parsed.data, context);
  } else if (value.origin && value.destination) {
    applyShipmentBusinessRules(
      errors,
      {
        origin: String(value.origin),
        destination: String(value.destination),
        weightKg: Number(value.weightKg),
        flightId: typeof value.flightId === "string" ? value.flightId : "",
      },
      context,
    );
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateShipmentUpdateFormDetailed(
  value: Record<string, unknown>,
  context?: {
    flights?: ShipmentFlightContext[];
    activeFlight?: ShipmentFlightContext | null;
  },
) {
  const parsed = shipmentUpdateSchema.safeParse(
    buildShipmentSubmitPayload({
      ...value,
      cargoMode: AIR_CARGO_MODE,
      vehicleType: AIR_VEHICLE_TYPE,
      pieces: DEFAULT_PIECES,
    }),
  );

  const errors: ShipmentUpdateFormErrors = parsed.success
    ? {}
    : mapZodFieldErrors<ShipmentUpdateFormField>(parsed.error.issues);

  if (parsed.success) {
    applyShipmentBusinessRules(errors, parsed.data, context);
  } else {
    applyShipmentBusinessRules(
      errors,
      {
        origin: typeof value.origin === "string" ? value.origin : undefined,
        destination: typeof value.destination === "string" ? value.destination : undefined,
        weightKg: value.weightKg === undefined ? undefined : Number(value.weightKg),
        flightId: typeof value.flightId === "string" ? value.flightId : "",
      },
      context,
    );
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateShipmentCreateForm(value: Record<string, unknown>) {
  const result = validateShipmentCreateFormDetailed(value);
  if (result.ok) {
    return { ok: true as const, message: undefined };
  }
  const firstMessage = Object.values(result.errors)[0];
  return {
    ok: false as const,
    message: firstMessage || "Input pengiriman tidak valid.",
  };
}

export function validateShipmentUpdateForm(value: Record<string, unknown>) {
  const result = validateShipmentUpdateFormDetailed(value);
  if (result.ok) {
    return { ok: true as const, message: undefined };
  }
  const firstMessage = Object.values(result.errors)[0];
  return {
    ok: false as const,
    message: firstMessage || "Perubahan pengiriman tidak valid.",
  };
}

export function validateInviteUserForm(value: {
  name: string;
  email: string;
  role: "admin" | "staff";
  station: string;
  customerAccountId?: string | null;
  password: string;
  confirmPassword: string;
}) {
  const parsed = inviteUserSchema.safeParse(value);
  if (parsed.success) {
    return { ok: true as const, message: undefined };
  }
  const firstIssue = parsed.error.issues[0];
  return {
    ok: false as const,
    message: firstIssue?.message || "Data undangan tidak valid.",
  };
}

export function hasDigitsInName(value: string) {
  return /\d/.test(value);
}

export function scrollToFirstFieldError(errors: Record<string, string | undefined>) {
  if (typeof document === "undefined") {
    return;
  }

  const firstField = Object.keys(errors).find((field) => errors[field]);
  if (!firstField) {
    return;
  }

  const target = document.querySelector(`[data-field="${firstField}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export { isValidAwbChecksum, NAME_NO_DIGITS_REGEX };