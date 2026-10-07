import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { ProveedorMui } from "./proveedor-mui";

// Material UI para una sección de la web (/presupuesto y la vista del cliente /q). El script fija `data-theme` (claro u oscuro,
// también el del sistema) antes de pintar: sin él, quien usa el modo oscuro del sistema vería un destello claro hasta que carga MUI.
export function ConMui({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InitColorSchemeScript attribute="data-theme" modeStorageKey="tema" />
      <ProveedorMui>{children}</ProveedorMui>
    </>
  );
}
