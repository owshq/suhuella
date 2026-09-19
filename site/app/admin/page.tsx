import { getOperationsBaseUrl } from "@/lib/operations/host";
import { permanentRedirect } from "next/navigation";

export default function AdminRedirectPage() {
  permanentRedirect(getOperationsBaseUrl());
}
