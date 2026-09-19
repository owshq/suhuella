import { redirectWithQuery } from "@/lib/redirect-with-query";

export default async function SuccessRedirect({
  searchParams,
}: PageProps<"/success">) {
  await redirectWithQuery("/license/success", searchParams);
}
