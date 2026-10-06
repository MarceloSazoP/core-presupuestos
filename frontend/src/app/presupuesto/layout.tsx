import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { ProveedorMui } from "./proveedor-mui";

// El script fija `data-theme` (claro u oscuro, también el del sistema) antes de pintar: sin él, quien usa el modo oscuro del
// sistema vería un destello claro hasta que carga MUI.
export default function LayoutPresupuesto({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InitColorSchemeScript attribute="data-theme" modeStorageKey="tema" />
      <ProveedorMui>{children}</ProveedorMui>
    </>
  );
}
