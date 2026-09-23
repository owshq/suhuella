import {
  getDnsInstructions,
  type CustomHostnameDnsInstruction,
} from "../cloudflare/custom-hostnames.ts";
import { isApexHostname, partnerHostnameUsesStandardCustomHostnameDns } from "./domains.ts";

export type PartnerDnsActivationStep = {
  order: number;
  en: string;
  es: string;
};

export type PartnerDnsRecordView = CustomHostnameDnsInstruction & {
  purposeLabel: { en: string; es: string };
};

const PURPOSE_LABELS: Record<
  CustomHostnameDnsInstruction["purpose"],
  { en: string; es: string }
> = {
  routing: {
    en: "Traffic — sends visitors to SuHuella on your hostname",
    es: "Tráfico — envía visitantes a SuHuella bajo tu hostname",
  },
  ownership: {
    en: "Ownership — proves you control this domain",
    es: "Propiedad — demuestra que controlas este dominio",
  },
  ssl: {
    en: "TLS certificate — required for https on your hostname",
    es: "Certificado TLS — necesario para https en tu hostname",
  },
  apex: {
    en: "Apex alternative — use only if your DNS provider supports ALIAS/ANAME",
    es: "Alternativa apex — solo si tu DNS admite ALIAS/ANAME",
  },
};

export function dnsPurposeLabel(
  purpose: CustomHostnameDnsInstruction["purpose"],
): { en: string; es: string } {
  return PURPOSE_LABELS[purpose] ?? { en: purpose, es: purpose };
}

export function partnerDnsRecordViews(
  instructions: CustomHostnameDnsInstruction[],
): PartnerDnsRecordView[] {
  return instructions.map((row) => ({
    ...row,
    purposeLabel: dnsPurposeLabel(row.purpose),
  }));
}

/** Step-by-step guide shown in the partner panel after they choose a hostname. */
export function partnerDnsActivationSteps(input: {
  hostname: string;
  status: string;
  cnameTarget: string | null;
  hasTxtRecords: boolean;
  localDevMode?: boolean;
}): PartnerDnsActivationStep[] {
  const hostname = input.hostname;
  const apex = isApexHostname(hostname);
  const standard = partnerHostnameUsesStandardCustomHostnameDns(hostname);
  const pending = input.status !== "active";

  if (input.localDevMode) {
    return [
      {
        order: 1,
        en: `Add to your hosts file: 127.0.0.1 ${hostname}  (macOS/Linux: /etc/hosts · Windows: C:\\Windows\\System32\\drivers\\etc\\hosts)`,
        es: `Añade al archivo hosts: 127.0.0.1 ${hostname}  (macOS/Linux: /etc/hosts · Windows: C:\\Windows\\System32\\drivers\\etc\\hosts)`,
      },
      {
        order: 2,
        en: "Review the DNS records below — in production you add these at your DNS provider. Local dev shows the same table for practice.",
        es: "Revisa los registros DNS abajo — en producción los añades en tu proveedor DNS. En local ves la misma tabla para practicar.",
      },
      {
        order: 3,
        en: 'Press Refresh validation — local dev activates the hostname without Cloudflare.',
        es: "Pulsa Refresh validation — en local se activa el hostname sin Cloudflare.",
      },
      {
        order: 4,
        en: pending
          ? `After Refresh shows active, open http://${hostname}:3000 (or your dev port) to see your brand on that hostname.`
          : `Open http://${hostname}:3000 (or your dev port) — your brand should load on this hostname.`,
        es: pending
          ? `Cuando Refresh muestre active, abre http://${hostname}:3000 (o tu puerto dev) para ver tu marca en ese hostname.`
          : `Abre http://${hostname}:3000 (o tu puerto dev) — tu marca debería cargar en este hostname.`,
      },
    ];
  }

  const steps: PartnerDnsActivationStep[] = [
    {
      order: 1,
      en: `Open DNS management at the provider where ${hostname} is registered (GoDaddy, Cloudflare, Hostinger, etc.). SuHuella does not move your nameservers.`,
      es: `Abre la gestión DNS donde está registrado ${hostname} (GoDaddy, Cloudflare, Hostinger, etc.). SuHuella no mueve tus nameservers.`,
    },
    {
      order: 2,
      en: apex
        ? `Add the ALIAS/ANAME or compatible apex record below pointing to ${input.cnameTarget ?? "the CNAME target shown"}. If your provider only supports CNAME, use a subdomain instead (e.g. app.yourdomain.com).`
        : standard
          ? `Create a CNAME record: host label "${hostname.split(".")[0]}" → target "${input.cnameTarget ?? "shown below"}". Do not add https:// or paths.`
          : `Create the CNAME record exactly as shown below for ${hostname}.`,
      es: apex
        ? `Añade el registro ALIAS/ANAME o apex compatible apuntando a ${input.cnameTarget ?? "el objetivo CNAME indicado"}. Si tu proveedor solo admite CNAME, usa un subdominio (p. ej. app.tudominio.com).`
        : standard
          ? `Crea un CNAME: etiqueta "${hostname.split(".")[0]}" → destino "${input.cnameTarget ?? "indicado abajo"}". Sin https:// ni rutas.`
          : `Crea el CNAME exactamente como se muestra abajo para ${hostname}.`,
    },
  ];

  if (input.hasTxtRecords) {
    steps.push({
      order: 3,
      en: "Add every TXT record below with the exact Name and Value. These validate ownership and issue the TLS certificate.",
      es: "Añade cada registro TXT con Name y Value exactos. Validan propiedad y emiten el certificado TLS.",
    });
  } else if (pending) {
    steps.push({
      order: 3,
      en: "TXT records for ownership/TLS appear here after SuHuella registers the hostname. Add the CNAME first, then press Refresh validation.",
      es: "Los TXT de propiedad/TLS aparecerán aquí tras registrar el hostname. Añade primero el CNAME y pulsa Refresh validation.",
    });
  }

  steps.push({
    order: steps.length + 1,
    en: pending
      ? "Wait for DNS propagation (often 5–60 minutes, sometimes longer). Then press Refresh validation in this panel until status is active."
      : "Your hostname is active. Open it in the browser — the URL stays on your domain.",
    es: pending
      ? "Espera la propagación DNS (a menudo 5–60 minutos, a veces más). Pulsa Refresh validation hasta que el estado sea active."
      : "Tu hostname está activo. Ábrelo en el navegador — la URL permanece en tu dominio.",
  });

  return steps;
}

export function buildPartnerDnsPackage(input: {
  hostname: string;
  status: string;
  cnameTarget: string | null;
  instructions?: CustomHostnameDnsInstruction[];
  localDevMode?: boolean;
}): {
  instructions: PartnerDnsRecordView[];
  steps: PartnerDnsActivationStep[];
  notes: string[];
} {
  const target = input.cnameTarget?.trim() || "";
  const baseInstructions =
    input.instructions?.length
      ? input.instructions
      : target
        ? getDnsInstructions(input.hostname, target)
        : [];
  const instructions = partnerDnsRecordViews(baseInstructions);
  const notes = [
    "Keep your nameservers at your current DNS provider. SuHuella does not move nameservers.",
    "Do not put Cloudflare Access on the public partner site — only on ops hostnames.",
  ];
  if (isApexHostname(input.hostname)) {
    notes.unshift(
      "Apex domains may require ALIAS/ANAME or a compatible mode. Prefer a subdomain when possible.",
    );
  }
  return {
    instructions,
    steps: partnerDnsActivationSteps({
      hostname: input.hostname,
      status: input.status,
      cnameTarget: target || null,
      hasTxtRecords: instructions.some((row) => row.type === "TXT"),
      localDevMode: input.localDevMode,
    }),
    notes,
  };
}
