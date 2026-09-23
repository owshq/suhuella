import { UnconfiguredHostnameScreen } from "@/components/web/UnconfiguredHostnameScreen";
import { SuhuellaApp } from "@/components/web/SuhuellaApp";
import { suhuellaShellMetadata, suhuellaShellProps } from "@/lib/suhuella-shell-props";

export { suhuellaShellMetadata as generateMetadata };

export async function SuhuellaShellPage() {
  const props = await suhuellaShellProps();
  const { presentationBrand } = props;

  if (!presentationBrand.servesApp) {
    return (
      <UnconfiguredHostnameScreen
        hostname={presentationBrand.hostname}
        kind={presentationBrand.kind}
        domainStatus={presentationBrand.domainStatus}
      />
    );
  }

  return (
    <SuhuellaApp
      presentationBrand={presentationBrand}
      paidCheckoutEnabled={props.paidCheckoutEnabled}
    />
  );
}
