// El QR de la portada web (Mecanismo de consulta, v1.3) es `corepresupuesto://web/<código de vínculo>`. Cualquier otro QR se rechaza:
// así la app nunca manda un vínculo a un sitio que no es el nuestro.
const QR = /^corepresupuesto:\/\/web\/([A-Za-z0-9_-]{20,64})$/;

export const codigoDeVinculo = (leido: string): string | null => QR.exec(leido.trim())?.[1] ?? null;
