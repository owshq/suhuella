import { redirectWithQuery } from "@/lib/redirect-with-query";

export default async function DescargaExitosaRedirect({
  searchParams,
}: PageProps<"/descarga-exitosa">) {
  await redirectWithQuery("/license/success", searchParams);
}
