export type FlightVisualMeta = {
  airlineCode: string;
  airlineName: string;
  airlineFullName: string;
  aircraftType: string;
  registration: string;
  category: string;
  aircraftImageUrl: string;
  airlineLogoUrl: string;
  brandColor: string;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1649486927127-8c16f6d175ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tZXJjaWFsJTIwYWlycGxhbmUlMjB3aGl0ZSUyMGJsdWUlMjBza3l8ZW58MXx8fHwxNzc1OTk4MDM3fDA&ixlib=rb-4.1.0&q=80&w=1080";

const AIRLINE_META: Record<string, Omit<FlightVisualMeta, "airlineCode">> = {
  GA: {
    airlineName: "Garuda Indonesia",
    airlineFullName: "PT Garuda Indonesia (Persero) Tbk",
    aircraftType: "Airbus A330-300",
    registration: "PK-GIG",
    category: "Wide-body",
    aircraftImageUrl:
      "https://images.unsplash.com/photo-1775056976112-c7597e555468?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxHYXJ1ZGElMjBJbmRvbmVzaWElMjBCb2VpbmclMjA3NzclMjBhaXJwbGFuZSUyMGJsdWUlMjBsaXZlcnl8ZW58MXx8fHwxNzc2MDAwMTkxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    airlineLogoUrl: "https://www.gstatic.com/flights/airline_logos/70px/GA.png",
    brandColor: "#0A4DA2",
  },
  QG: {
    airlineName: "Citilink",
    airlineFullName: "PT Citilink Indonesia",
    aircraftType: "Airbus A320neo",
    registration: "PK-GQK",
    category: "Narrow-body",
    aircraftImageUrl:
      "https://images.unsplash.com/photo-1666239553251-6a22ecf60417?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxDaXRpbGluayUyMEFpcmJ1cyUyMEEzMjAlMjBncmVlbiUyMGFpcnBsYW5lfGVufDF8fHx8MTc3NTk5ODAzNnww&ixlib=rb-4.1.0&q=80&w=1080",
    airlineLogoUrl: "https://www.gstatic.com/flights/airline_logos/70px/QG.png",
    brandColor: "#00A650",
  },
  ID: {
    airlineName: "Batik Air",
    airlineFullName: "PT Batik Air Indonesia",
    aircraftType: "Airbus A320-200",
    registration: "PK-LUH",
    category: "Narrow-body",
    aircraftImageUrl:
      "https://images.unsplash.com/photo-1752901441555-e83cbbad97a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxCYXRpayUyMEFpciUyMEJvZWluZyUyMGFpcnBsYW5lJTIwbGl2ZXJ5fGVufDF8fHx8MTc3NTk5ODAzNnww&ixlib=rb-4.1.0&q=80&w=1080",
    airlineLogoUrl: "https://www.gstatic.com/flights/airline_logos/70px/ID.png",
    brandColor: "#8B0000",
  },
  SJ: {
    airlineName: "Sriwijaya Air",
    airlineFullName: "PT Sriwijaya Air",
    aircraftType: "Boeing 737-500F",
    registration: "PK-CJC",
    category: "Cargo narrow-body",
    aircraftImageUrl:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
    airlineLogoUrl: "https://www.gstatic.com/flights/airline_logos/70px/SJ.png",
    brandColor: "#C62828",
  },
  QF: {
    airlineName: "Qantas",
    airlineFullName: "Qantas Airways Limited",
    aircraftType: "Airbus A380-800",
    registration: "VH-OQA",
    category: "Wide-body",
    aircraftImageUrl:
      "https://images.unsplash.com/photo-1775449067175-7bca27f9934f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxRYW50YXMlMjBBaXJidXMlMjBBMzgwJTIwcmVkJTIwa2FuZ2Fyb28lMjBhaXJwbGFuZXxlbnwxfHx8fDE3NzU5OTg2MDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    airlineLogoUrl: "https://www.gstatic.com/flights/airline_logos/70px/QF.png",
    brandColor: "#E0112B",
  },
};

export function getFlightVisualMeta(flightNumber: string, aircraftType?: string | null, imageUrl?: string | null): FlightVisualMeta {
  const airlineCode = flightNumber.split("-")[0]?.toUpperCase() || "GA";
  const base = AIRLINE_META[airlineCode] || {
    airlineName: airlineCode,
    airlineFullName: `Airline ${airlineCode}`,
    aircraftType: aircraftType || "Boeing 737-800",
    registration: "PK-XXX",
    category: "Narrow-body",
    aircraftImageUrl: FALLBACK_IMAGE,
    airlineLogoUrl: `https://www.gstatic.com/flights/airline_logos/70px/${airlineCode}.png`,
    brandColor: "#0052CC",
  };

  return {
    airlineCode,
    airlineName: base.airlineName,
    airlineFullName: base.airlineFullName,
    aircraftType: aircraftType || base.aircraftType,
    registration: base.registration,
    category: base.category,
    aircraftImageUrl: imageUrl || base.aircraftImageUrl,
    airlineLogoUrl: base.airlineLogoUrl,
    brandColor: base.brandColor,
  };
}

export function getShipmentPriorityScore(input: {
  status: string;
  docStatus?: string | null;
  readiness?: string | null;
  updatedAt?: string | Date;
}) {
  const statusOrder: Record<string, number> = {
    hold: 0,
    received: 1,
    sortation: 2,
    loaded_to_aircraft: 3,
    departed: 4,
    arrived: 5,
  };

  const docPenalty = input.docStatus && input.docStatus !== "Complete" ? -2 : 0;
  const readinessPenalty = input.readiness && input.readiness !== "Ready" ? -1 : 0;
  return (statusOrder[input.status] ?? 99) + docPenalty + readinessPenalty;
}
