// El QR de recuperación del correo es `corepresupuesto://recuperar/<token>` (256 bits en base64url, 43 caracteres). También se acepta el
// código de texto solo. Cualquier otro QR se rechaza: la app no manda nada que no tenga esa forma.
const QR = /^(?:corepresupuesto:\/\/recuperar\/)?([A-Za-z0-9_-]{43})$/;

export const tokenDeRecuperacion = (leido: string): string | null => QR.exec(leido.trim().replace(/\s+/g, ''))?.[1] ?? null;
